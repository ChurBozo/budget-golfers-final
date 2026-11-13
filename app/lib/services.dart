import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/widgets.dart';

import 'data/account_controller.dart';
import 'data/bag_repository.dart';
import 'data/course_repository.dart';
import 'data/download_service.dart';
import 'data/round_repository.dart';
import 'data/upload_service.dart';

/// The app-wide account and upload queue, created once in main().
class Services {
  Services._();

  static late AccountController account;
  static late UploadService uploads;
  static late DownloadService downloads;

  static AppLifecycleListener? _lifecycle;
  static StreamSubscription<List<ConnectivityResult>>? _connectivity;

  static Future<void> init() async {
    account = AccountController();
    await account.load();
    uploads = UploadService(
      account: account,
      rounds: RoundRepository.instance,
      loadBag: BagRepository.instance.load,
    );
    downloads = DownloadService(
      account: account,
      rounds: RoundRepository.instance,
      knownCourses: CourseRepository.instance.names,
      rememberCourse: CourseRepository.instance.save,
    );
  }

  /// Uploads waiting rounds when the app opens, comes back to the front, or
  /// gets a connection. Nothing happens while the golfer is signed out.
  static void startAutoUpload() {
    _lifecycle ??= AppLifecycleListener(onResume: () => uploads.autoUpload());
    _connectivity ??= Connectivity().onConnectivityChanged.listen((results) {
      if (results.any((r) => r != ConnectivityResult.none)) uploads.autoUpload();
    });
    uploads.autoUpload();
  }
}
