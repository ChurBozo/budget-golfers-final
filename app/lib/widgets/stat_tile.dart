import 'package:flutter/material.dart';

/// A small card with a label and a big number, like the website's stat cards.
class StatTile extends StatelessWidget {
  final String label;
  final String value;
  final String? suffix;
  final String? caption;

  const StatTile({
    super.key,
    required this.label,
    required this.value,
    this.suffix,
    this.caption,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: theme.colorScheme.outlineVariant),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label.toUpperCase(),
              style: theme.textTheme.labelSmall?.copyWith(letterSpacing: 0.8),
            ),
            const SizedBox(height: 4),
            Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Text(
                  value,
                  style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
                ),
                if (suffix != null) ...[
                  const SizedBox(width: 3),
                  Text(suffix!, style: theme.textTheme.bodyMedium),
                ],
              ],
            ),
            if (caption != null) ...[
              const SizedBox(height: 2),
              Text(caption!, style: theme.textTheme.bodySmall),
            ],
          ],
        ),
      ),
    );
  }
}

/// A rounded card section with an optional title, used across screens.
class SectionCard extends StatelessWidget {
  final String? title;
  final Widget child;
  final Widget? trailing;
  final EdgeInsetsGeometry padding;

  const SectionCard({
    super.key,
    this.title,
    required this.child,
    this.trailing,
    this.padding = const EdgeInsets.all(16),
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      elevation: 0,
      margin: const EdgeInsets.symmetric(vertical: 6),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: theme.colorScheme.outlineVariant),
      ),
      child: Padding(
        padding: padding,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (title != null) ...[
              Row(
                children: [
                  Expanded(child: Text(title!, style: theme.textTheme.titleMedium)),
                  if (trailing != null) trailing!,
                ],
              ),
              const SizedBox(height: 10),
            ],
            child,
          ],
        ),
      ),
    );
  }
}
