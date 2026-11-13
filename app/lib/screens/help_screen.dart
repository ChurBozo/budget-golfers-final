import 'package:flutter/material.dart';

/// Help & walkthrough, updated from the old app for the new controls.
class HelpScreen extends StatelessWidget {
  const HelpScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Help')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Welcome to Budget Golfers', style: theme.textTheme.titleLarge),
          const SizedBox(height: 8),
          const Text(
            'A free digital caddy: score your round, mark your shots with GPS, and learn how far '
            'and how straight you hit each club. No account is needed.',
          ),
          const SizedBox(height: 12),
          const _HelpTile(title: 'Start a round', lines: [
            'Tap New Round on Home.',
            'Type the course name. Any name works, including courses that aren\'t in any course list. Names you have used before are suggested.',
            'Add a tee if you like, then choose 18 holes, or 9 (front or back).',
            'Tap Tee off.',
          ]),
          const _HelpTile(title: 'Scoring: Shot +, Putt +, Penalty, Undo', lines: [
            'Shot + records a full shot from where you are standing, with the club shown on the club button.',
            'Putt + adds a putt. Penalty adds a penalty stroke.',
            'Your score for the hole is shots + putts + penalties. Undo removes the last thing you added.',
            'Swipe left or right, use the arrows, or tap the scorecard to change hole.',
            'Tap the par to change it. Pars are remembered for that course name.',
            'Tap where your last shot finished (Fairway, Rough L, Rough R, Bunker, Green, Penalty). This gives you fairways hit and your common miss.',
          ]),
          const _HelpTile(title: 'The map: target and landing pins', lines: [
            'Tap Map on the scoring screen.',
            'Tap the map to place the RED target pin. The distance to it and a suggested club appear at the top.',
            'Long-press, or tap "Ball is here", to place the ORANGE pin where your last shot landed.',
            'Drag either pin to adjust it.',
            '"Hit shot from here" records the next shot aimed at the red pin.',
          ]),
          const _HelpTile(title: 'Club suggestions', lines: [
            'The suggestion is the shortest club in your bag that still reaches the target.',
            'Each club uses your measured average once it has 5 shots with a landing point; until then, the distance you typed in Profile > Clubs.',
          ]),
          const _HelpTile(title: 'Accuracy and bias', lines: [
            'Accuracy: 100% means the ball finished on the target; 0% means you missed by as much as the shot\'s length.',
            'Bias: the angle between the target line and where the ball went. Right is positive, left is negative.',
          ]),
          const _HelpTile(title: 'Finishing and past rounds', lines: [
            'Tap Finish when every hole has a score. You can add a note.',
            'Past Rounds shows each round with its score and upload state. Open one for the scorecard and the shots on the map.',
            'Your round in progress is saved after every tap. If you close the app, resume it from Home.',
          ]),
          const _HelpTile(title: 'Uploading', lines: [
            'Rounds are saved on this phone first, so poor signal on the course never loses one.',
            'To see them on the Budget Golfers website, tap Sign in to upload on the home screen. You only need an account to upload, never to play.',
            'Once you are signed in, a finished round uploads straight away, or as soon as the phone has signal again. A green cloud means it is on the website.',
            'A red cloud means the server could not store the round. Open it to see why, then tap Try again.',
          ]),
        ],
      ),
    );
  }
}

class _HelpTile extends StatelessWidget {
  final String title;
  final List<String> lines;

  const _HelpTile({required this.title, required this.lines});

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Theme.of(context).colorScheme.outlineVariant),
      ),
      child: ExpansionTile(
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
        childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
        expandedCrossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final line in lines)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Text('•  $line'),
            ),
        ],
      ),
    );
  }
}
