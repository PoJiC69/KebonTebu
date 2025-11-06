import 'dart:math';
import 'package:flutter/material.dart';

class GameQiuqiuScreen extends StatefulWidget {
  @override
  _GameQiuqiuScreenState createState() => _GameQiuqiuScreenState();
}

/// Qiu Qiu evaluator (simple 3-card "niu" style for prototype)
/// Rules implemented:
/// - Values: A=1, 2..10 = numeric, J/Q/K = 10
/// - Score = (sum of values) % 10; if score == 0 => "Qiu Qiu" (best normal)
/// - Special: Three-of-a-kind (Triple) detected (treated as superior)
/// - Special: Three-face (all J/Q/K) detected (treated as strong)
class _GameQiuqiuScreenState extends State<GameQiuqiuScreen> {
  final Random _rng = Random();
  List<int> player = [];
  String result = '';

  void drawHand() {
    List<int> deck = List<int>.generate(52, (i) => i);
    deck.shuffle(_rng);
    setState(() {
      player = deck.sublist(0, 3);
      result = evaluate(player);
    });
  }

  int _rankIndex(int cardIndex) => cardIndex % 13; // 0..12
  String _rankStr(int id) {
    final ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
    return ranks[id % 13];
  }

  int _valueForNiu(int cardIndex) {
    final r = _rankIndex(cardIndex);
    if (r >= 10) return 10; // J Q K
    if (r == 0) return 1; // A
    return r + 1;
  }

  String evaluate(List<int> hand) {
    if (hand.length != 3) return '';
    final ranks = hand.map((c) => _rankIndex(c)).toList();
    final values = hand.map(_valueForNiu).toList();

    // three-of-a-kind
    if (ranks[0] == ranks[1] && ranks[1] == ranks[2]) {
      return 'Triple (Three-of-a-kind)';
    }

    // three-face: all J/Q/K
    final allFace = ranks.every((r) => r >= 10);
    if (allFace) return 'Three-face (J/Q/K)';

    final sum = values.reduce((a, b) => a + b);
    final score = sum % 10;
    if (score == 0) return 'Qiu Qiu (0)';
    return 'Score: $score';
  }

  Widget _cardBox(int id) {
    final suits = ['♠','♥','♦','♣'];
    final suit = suits[id % 4];
    final rank = _rankStr(id);
    return Container(
      margin: EdgeInsets.symmetric(horizontal: 6),
      padding: EdgeInsets.all(12),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8)),
      child: Column(
        children: [
          Text(rank, style: TextStyle(fontWeight: FontWeight.bold)),
          Text(suit),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Qiu Qiu — Optimized Demo'),
      ),
      body: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          children: [
            Text('Qiu Qiu demo: 3 kartu. J/Q/K = 10, A = 1. Score = sum(values) % 10', style: TextStyle(fontSize: 16)),
            SizedBox(height: 16),
            if (player.isNotEmpty)
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: player.map((c) => _cardBox(c)).toList(),
              ),
            SizedBox(height: 12),
            if (result.isNotEmpty) Text(result, style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            Spacer(),
            ElevatedButton(
              onPressed: drawHand,
              child: Text('Draw 3 Kartu'),
            ),
          ],
        ),
      ),
    );
  }
}