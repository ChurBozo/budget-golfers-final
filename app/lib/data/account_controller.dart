import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:uuid/uuid.dart';

import '../config.dart';
import 'api_client.dart';

/// Small key-value storage. On the phone it is the Android Keystore-backed
/// secure storage; tests use [MemoryKeyValueStore].
abstract class KeyValueStore {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
  Future<void> delete(String key);
}

class SecureKeyValueStore implements KeyValueStore {
  final FlutterSecureStorage _storage = const FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true, resetOnError: true),
  );

  @override
  Future<String?> read(String key) => _storage.read(key: key);

  @override
  Future<void> write(String key, String value) => _storage.write(key: key, value: value);

  @override
  Future<void> delete(String key) => _storage.delete(key: key);
}

class MemoryKeyValueStore implements KeyValueStore {
  final Map<String, String> values = {};

  @override
  Future<String?> read(String key) async => values[key];

  @override
  Future<void> write(String key, String value) async => values[key] = value;

  @override
  Future<void> delete(String key) async => values.remove(key);
}

/// The signed-in golfer, as returned by POST /api/auth/login.
class Account {
  final String userId;
  final String email;
  final String displayName;
  final String token;
  final DateTime expiresAt;

  /// True once this phone's bag has been sent with PUT /api/clubs/:userId.
  final bool bagSynced;

  const Account({
    required this.userId,
    required this.email,
    required this.displayName,
    required this.token,
    required this.expiresAt,
    this.bagSynced = false,
  });

  /// Treat the token as expired five minutes early, so an upload never
  /// starts with a token that runs out halfway.
  bool get expired => DateTime.now().isAfter(expiresAt.subtract(const Duration(minutes: 5)));

  Account copyWith({String? displayName, bool? bagSynced}) => Account(
        userId: userId,
        email: email,
        displayName: displayName ?? this.displayName,
        token: token,
        expiresAt: expiresAt,
        bagSynced: bagSynced ?? this.bagSynced,
      );

  /// Builds the account from the API's `{ token, expiresIn, user }`.
  factory Account.fromAuth(Map<String, dynamic> data, {DateTime? now}) {
    final user = Map<String, dynamic>.from(data['user'] as Map);
    final seconds = (data['expiresIn'] as num?)?.toInt() ?? 3600;
    return Account(
      userId: user['id'] as String,
      email: user['email'] as String,
      displayName: user['displayName'] as String,
      token: data['token'] as String,
      expiresAt: (now ?? DateTime.now()).add(Duration(seconds: seconds)),
    );
  }

  Map<String, dynamic> toJson() => {
        'userId': userId,
        'email': email,
        'displayName': displayName,
        'token': token,
        'expiresAt': expiresAt.toIso8601String(),
        'bagSynced': bagSynced,
      };

  static Account fromJson(Map<String, dynamic> m) => Account(
        userId: m['userId'] as String,
        email: m['email'] as String,
        displayName: m['displayName'] as String,
        token: m['token'] as String,
        expiresAt: DateTime.parse(m['expiresAt'] as String),
        bagSynced: (m['bagSynced'] as bool?) ?? false,
      );
}

/// Sign-in state for uploading. The app works fully without an account; the
/// golfer only signs in when they want their rounds on the website.
class AccountController extends ChangeNotifier {
  static const _accountKey = 'account';
  static const _deviceKey = 'device_id';
  static const _serverKey = 'api_base_url';
  static const _lastEmailKey = 'last_email';
  static const _lastUserKey = 'last_user_id';

  final KeyValueStore _store;
  late final ApiClient api;

  Account? _account;
  String _baseUrl = AppConfig.defaultApiBaseUrl;
  String? _deviceId;
  String? _lastEmail;
  String? _lastUserId;
  String? _previousUserId;
  bool _sessionExpired = false;

  /// [httpClient] is only passed by tests (a MockClient).
  AccountController({KeyValueStore? store, http.Client? httpClient})
      : _store = store ?? SecureKeyValueStore() {
    api = ApiClient(
      httpClient: httpClient,
      baseUrl: () => _baseUrl,
      token: () async => signedIn ? _account!.token : null,
    );
  }

  Account? get account => _account;
  bool get signedIn => _account != null && !_account!.expired;
  String get baseUrl => _baseUrl;
  String? get lastEmail => _lastEmail;

  /// The account that was signed in on this phone before the current one, if
  /// it was a different account (used to ask who waiting rounds belong to).
  String? get previousUserId => _previousUserId;

  /// True when the golfer was signed in but the token ran out; the app asks
  /// them to sign in again before the next upload.
  bool get sessionExpired => _sessionExpired;

  Future<void> load() async {
    try {
      final raw = await _store.read(_accountKey);
      if (raw != null) {
        _account = Account.fromJson(jsonDecode(raw) as Map<String, dynamic>);
        if (_account!.expired) {
          _lastEmail = _account!.email;
          _account = null;
          _sessionExpired = true;
          await _store.delete(_accountKey);
        }
      }
      _baseUrl = (await _store.read(_serverKey)) ?? AppConfig.defaultApiBaseUrl;
      _deviceId = await _store.read(_deviceKey);
      _lastEmail ??= await _store.read(_lastEmailKey);
      _lastUserId = await _store.read(_lastUserKey);
    } catch (e) {
      // A damaged store only means signing in again.
      debugPrint('Account store could not be read: $e');
      _account = null;
    }
    notifyListeners();
  }

  /// A random id for this install, sent with uploads (users.devices on the server).
  Future<String> deviceId() async {
    final existing = _deviceId;
    if (existing != null) return existing;
    final id = 'app-${const Uuid().v4().substring(0, 8)}';
    _deviceId = id;
    await _store.write(_deviceKey, id);
    return id;
  }

  Future<void> setBaseUrl(String url) async {
    final clean = url.trim().replaceAll(RegExp(r'/+$'), '');
    if (clean == _baseUrl) return;
    _baseUrl = clean;
    await _store.write(_serverKey, clean);
    // A token from another server is meaningless here.
    if (_account != null) await signOut();
    notifyListeners();
  }

  Future<void> resetBaseUrl() => setBaseUrl(AppConfig.defaultApiBaseUrl);

  Future<Account> signIn({required String email, required String password}) async {
    final result = await api.login(email: email, password: password, deviceId: await deviceId());
    return _save(Account.fromAuth(result.data));
  }

  Future<Account> register({
    required String email,
    required String password,
    required String displayName,
    String? homeCourseName,
  }) async {
    final result = await api.register(
      email: email,
      password: password,
      displayName: displayName,
      homeCourseName: homeCourseName,
      deviceId: await deviceId(),
    );
    return _save(Account.fromAuth(result.data));
  }

  Future<Account> _save(Account account) async {
    _previousUserId = (_lastUserId != null && _lastUserId != account.userId) ? _lastUserId : null;
    _lastUserId = account.userId;
    _account = account;
    _lastEmail = account.email;
    _sessionExpired = false;
    await _store.write(_accountKey, jsonEncode(account.toJson()));
    await _store.write(_lastEmailKey, account.email);
    await _store.write(_lastUserKey, account.userId);
    notifyListeners();
    return account;
  }

  Future<void> markBagSynced() async {
    final a = _account;
    if (a == null || a.bagSynced) return;
    _account = a.copyWith(bagSynced: true);
    await _store.write(_accountKey, jsonEncode(_account!.toJson()));
  }

  /// Signs out on this phone. Rounds stay on the phone and on the server.
  Future<void> signOut() async {
    _account = null;
    _sessionExpired = false;
    await _store.delete(_accountKey);
    notifyListeners();
  }

  /// Called when the server answers 401 to a signed-in request.
  Future<void> expireSession() async {
    if (_account == null) return;
    _lastEmail = _account!.email;
    _account = null;
    _sessionExpired = true;
    await _store.delete(_accountKey);
    notifyListeners();
  }
}
