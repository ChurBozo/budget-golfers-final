import 'package:flutter/material.dart';

/// A dialog that owns its own [TextEditingController].
///
/// `showDialog` returns as soon as the dialog is popped, but the dialog stays
/// on screen for its closing animation, and its TextField keeps using the
/// controller until then. Disposing the controller straight after
/// `await showDialog(...)` therefore breaks the widget tree (the red
/// "'_dependents.isEmpty': is not true" screen). Here the controller lives in
/// the dialog's State, so Flutter disposes it only once the dialog has gone.
class ControllerDialog extends StatefulWidget {
  const ControllerDialog({super.key, this.initialText = '', required this.builder});

  final String initialText;
  final Widget Function(BuildContext context, TextEditingController controller) builder;

  @override
  State<ControllerDialog> createState() => _ControllerDialogState();
}

class _ControllerDialogState extends State<ControllerDialog> {
  late final TextEditingController _controller = TextEditingController(text: widget.initialText);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.builder(context, _controller);
}
