import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

/// One problem with a field, from the API's `error.details`.
class ApiIssue {
  final String field;
  final String issue;

  const ApiIssue(this.field, this.issue);

  @override
  String toString() => '$field $issue';
}

/// An error from the Budget Golfers API, in its standard error shape:
/// `{ success: false, error: { status, code, message, details?, requestId } }`.
/// [status] is 0 when the server could not be reached at all.
class ApiException implements Exception {
  final int status;
  final String code;
  final String message;
  final List<ApiIssue> details;
  final String? requestId;

  const ApiException(
    this.status,
    this.code,
    this.message, {
    this.details = const [],
    this.requestId,
  });

  factory ApiException.network([String? why]) => ApiException(
        0,
        'NETWORK',
        why ?? 'Could not reach the Budget Golfers server. Check your connection.',
      );

  bool get isNetwork => status == 0;
  bool get isUnauthenticated => status == 401;
  bool get isValidation => status == 422;

  /// 429, 5xx and no connection: the same request may work later.
  bool get isTemporary => isNetwork || status == 408 || status == 429 || status >= 500;

  /// Issues for one field, e.g. issueFor('email').
  String? issueFor(String field) {
    for (final d in details) {
      if (d.field == field) return d.issue;
    }
    return null;
  }

  @override
  String toString() => 'ApiException($status $code: $message)';
}

/// A successful response: the HTTP status and the envelope's `data`.
class ApiResult {
  final int status;
  final Map<String, dynamic> data;

  const ApiResult(this.status, this.data);
}

/// Talks to the Budget Golfers REST API. Every call returns the envelope's
/// `data` or throws an [ApiException].
class ApiClient {
  final http.Client _http;
  final String Function() _baseUrl;
  final Future<String?> Function() _token;
  final Duration timeout;

  ApiClient({
    http.Client? httpClient,
    required String Function() baseUrl,
    required Future<String?> Function() token,
    this.timeout = const Duration(seconds: 20),
  })  : _http = httpClient ?? http.Client(),
        _baseUrl = baseUrl,
        _token = token;

  // ---------- endpoints used by the app ----------

  /// POST /api/auth/login. The app asks for its longer-lived token.
  Future<ApiResult> login({
    required String email,
    required String password,
    required String deviceId,
  }) =>
      _send('POST', '/api/auth/login', auth: false, body: {
        'email': email.trim(),
        'password': password,
        'client': 'mobile-app',
        'device': {'deviceId': deviceId, 'platform': _platform},
      });

  /// POST /api/auth/register.
  Future<ApiResult> register({
    required String email,
    required String password,
    required String displayName,
    String? homeCourseName,
    required String deviceId,
  }) =>
      _send('POST', '/api/auth/register', auth: false, body: {
        'email': email.trim(),
        'password': password,
        'displayName': displayName.trim(),
        if (homeCourseName != null && homeCourseName.trim().isNotEmpty)
          'homeCourseName': homeCourseName.trim(),
        'client': 'mobile-app',
        'device': {'deviceId': deviceId, 'platform': _platform},
      });

  /// GET /api/users/me.
  Future<ApiResult> me() => _send('GET', '/api/users/me');

  /// POST /api/rounds. 201 = stored, 200 = it was already stored (duplicate).
  Future<ApiResult> uploadRound(Map<String, dynamic> body, {required String deviceId}) =>
      _send('POST', '/api/rounds', body: body, headers: {
        'X-Device-Id': deviceId,
        'X-Device-Platform': _platform,
      });

  /// PUT /api/clubs/:userId: replaces the bag on the server.
  Future<ApiResult> putClubs(String userId, List<Map<String, dynamic>> clubs) =>
      _send('PUT', '/api/clubs/$userId', body: {'clubs': clubs});

  /// GET /api/health, used by the server address check in Settings.
  Future<ApiResult> health() => _send('GET', '/api/health', auth: false);

  // ---------- plumbing ----------

  static String get _platform {
    try {
      if (Platform.isAndroid) return 'android';
      if (Platform.isIOS) return 'ios';
    } catch (_) {
      // Platform is not available on the web.
    }
    return 'other';
  }

  Uri _uri(String path) {
    final base = _baseUrl().trim().replaceAll(RegExp(r'/+$'), '');
    return Uri.parse('$base$path');
  }

  Future<ApiResult> _send(
    String method,
    String path, {
    Map<String, dynamic>? body,
    Map<String, String>? headers,
    bool auth = true,
  }) async {
    final Uri uri;
    try {
      uri = _uri(path);
    } on FormatException {
      throw const ApiException(0, 'BAD_ADDRESS', 'The server address is not valid. Check it in Settings.');
    }

    final request = http.Request(method, uri)
      ..headers['Accept'] = 'application/json'
      ..headers.addAll(headers ?? const {});
    if (body != null) {
      request.headers['Content-Type'] = 'application/json';
      request.body = jsonEncode(body);
    }
    if (auth) {
      final token = await _token();
      if (token == null) {
        throw const ApiException(401, 'UNAUTHENTICATED', 'Sign in to upload your rounds.');
      }
      request.headers['Authorization'] = 'Bearer $token';
    }

    final http.Response response;
    try {
      final streamed = await _http.send(request).timeout(timeout);
      response = await http.Response.fromStream(streamed).timeout(timeout);
    } on TimeoutException {
      throw ApiException.network('The Budget Golfers server took too long to answer.');
    } on SocketException {
      throw ApiException.network();
    } on http.ClientException {
      throw ApiException.network();
    } on HandshakeException {
      throw ApiException.network('A secure connection to the server could not be made.');
    }

    return _decode(response);
  }

  static ApiResult _decode(http.Response response) {
    Map<String, dynamic>? json;
    if (response.body.isNotEmpty) {
      try {
        final decoded = jsonDecode(utf8.decode(response.bodyBytes));
        if (decoded is Map<String, dynamic>) json = decoded;
      } on FormatException {
        json = null;
      }
    }

    final ok = response.statusCode >= 200 && response.statusCode < 300;
    if (ok && (json == null || json['success'] != false)) {
      final data = json?['data'];
      return ApiResult(response.statusCode, data is Map<String, dynamic> ? data : <String, dynamic>{});
    }

    final error = json?['error'];
    if (error is Map<String, dynamic>) {
      final details = <ApiIssue>[
        for (final d in (error['details'] as List? ?? const []))
          if (d is Map) ApiIssue('${d['field']}', '${d['issue']}'),
      ];
      throw ApiException(
        (error['status'] as num?)?.toInt() ?? response.statusCode,
        '${error['code'] ?? 'ERROR'}',
        '${error['message'] ?? 'Something went wrong.'}',
        details: details,
        requestId: error['requestId'] as String?,
      );
    }
    throw ApiException(
      response.statusCode,
      'UNEXPECTED_RESPONSE',
      response.statusCode >= 500
          ? 'The Budget Golfers server had a problem. Please try again later.'
          : 'The server sent an unexpected reply (HTTP ${response.statusCode}). Check the server address in Settings.',
    );
  }
}
