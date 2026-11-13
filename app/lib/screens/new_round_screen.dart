import 'package:flutter/material.dart';

import '../data/course_repository.dart';
import '../data/round_repository.dart';
import '../models/round.dart';
import '../util/format.dart';
import 'scoring_screen.dart';

/// Starts a round. Golfers type the course name themselves (lots of
/// municipal courses aren't in any course database); names used before are
/// suggested, and their pars are remembered.
class NewRoundScreen extends StatefulWidget {
  const NewRoundScreen({super.key});

  @override
  State<NewRoundScreen> createState() => _NewRoundScreenState();
}

class _NewRoundScreenState extends State<NewRoundScreen> {
  static const _teeSuggestions = ['Yellow', 'White', 'Blue', 'Red', 'Black'];

  List<String> _names = const [];
  TextEditingController? _courseController;
  final _teeController = TextEditingController();
  int _holes = 18;
  int _startHole = 1;
  DateTime _date = DateTime.now();
  bool _starting = false;

  @override
  void initState() {
    super.initState();
    CourseRepository.instance.names().then((names) {
      if (mounted) setState(() => _names = names);
    });
  }

  @override
  void dispose() {
    _teeController.dispose();
    super.dispose();
  }

  bool _isToday(DateTime d) {
    final now = DateTime.now();
    return d.year == now.year && d.month == now.month && d.day == now.day;
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime(now.year - 5),
      lastDate: now,
    );
    if (picked != null && mounted) setState(() => _date = picked);
  }

  Future<void> _start() async {
    final name = (_courseController?.text ?? '').trim();
    if (name.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Type the course name first.')),
      );
      return;
    }
    setState(() => _starting = true);
    final pars = await CourseRepository.instance.parsFor(name);
    await CourseRepository.instance.save(name, pars);
    final now = DateTime.now();
    final playedAt = _isToday(_date)
        ? now
        : DateTime(_date.year, _date.month, _date.day, now.hour, now.minute);
    final round = Round.start(
      courseName: name,
      tee: _teeController.text,
      holesPlayed: _holes,
      startHole: _holes == 9 ? _startHole : 1,
      coursePars: pars,
      playedAt: playedAt,
    );
    await RoundRepository.instance.save(round);
    if (!mounted) return;
    await Navigator.of(context).pushReplacement(
      MaterialPageRoute<void>(builder: (_) => ScoringScreen(round: round)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('New round')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Course', style: theme.textTheme.titleMedium),
          const SizedBox(height: 8),
          Autocomplete<String>(
            optionsBuilder: (value) {
              final q = value.text.trim().toLowerCase();
              if (q.isEmpty) return const Iterable<String>.empty();
              return _names.where((n) => n.toLowerCase().contains(q));
            },
            fieldViewBuilder: (context, controller, focusNode, onSubmitted) {
              _courseController = controller;
              return TextField(
                controller: controller,
                focusNode: focusNode,
                textCapitalization: TextCapitalization.words,
                decoration: const InputDecoration(
                  border: OutlineInputBorder(),
                  hintText: 'e.g. Te Puke Golf Club',
                  prefixIcon: Icon(Icons.golf_course),
                ),
                onSubmitted: (_) => onSubmitted(),
              );
            },
          ),
          if (_names.isNotEmpty) ...[
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 4,
              children: [
                for (final n in _names.take(6))
                  ActionChip(
                    label: Text(n),
                    onPressed: () {
                      final c = _courseController;
                      if (c == null) return;
                      c.text = n;
                      c.selection = TextSelection.collapsed(offset: n.length);
                    },
                  ),
              ],
            ),
          ],
          const SizedBox(height: 4),
          Text(
            'Type any name. Pars you set on the scorecard are remembered for this course.',
            style: theme.textTheme.bodySmall,
          ),
          const SizedBox(height: 20),
          Text('Tee (optional)', style: theme.textTheme.titleMedium),
          const SizedBox(height: 8),
          TextField(
            controller: _teeController,
            textCapitalization: TextCapitalization.words,
            decoration: const InputDecoration(
              border: OutlineInputBorder(),
              hintText: 'e.g. Yellow',
            ),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            children: [
              for (final t in _teeSuggestions)
                ChoiceChip(
                  label: Text(t),
                  selected: _teeController.text == t,
                  onSelected: (_) => setState(() => _teeController.text = t),
                ),
            ],
          ),
          const SizedBox(height: 20),
          Text('Holes', style: theme.textTheme.titleMedium),
          const SizedBox(height: 8),
          SegmentedButton<int>(
            segments: const [
              ButtonSegment(value: 18, label: Text('18 holes')),
              ButtonSegment(value: 9, label: Text('9 holes')),
            ],
            selected: {_holes},
            onSelectionChanged: (s) => setState(() => _holes = s.first),
          ),
          if (_holes == 9) ...[
            const SizedBox(height: 10),
            SegmentedButton<int>(
              segments: const [
                ButtonSegment(value: 1, label: Text('Front nine (1–9)')),
                ButtonSegment(value: 10, label: Text('Back nine (10–18)')),
              ],
              selected: {_startHole},
              onSelectionChanged: (s) => setState(() => _startHole = s.first),
            ),
          ],
          const SizedBox(height: 20),
          Text('Date', style: theme.textTheme.titleMedium),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.event),
            title: Text(_isToday(_date) ? 'Today' : Fmt.date(_date)),
            trailing: TextButton(onPressed: _pickDate, child: const Text('Change')),
          ),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: _starting ? null : _start,
            icon: const Icon(Icons.flag),
            label: const Padding(
              padding: EdgeInsets.symmetric(vertical: 12),
              child: Text('Tee off', style: TextStyle(fontSize: 18)),
            ),
          ),
        ],
      ),
    );
  }
}
