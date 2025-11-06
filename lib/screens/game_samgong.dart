import 'dart:math';
import 'package:flutter/material.dart';

class GameSamgongScreen extends StatefulWidget {
  @override
  _GameSamgongScreenState createState() => _GameSamgongScreenState();
}

/// Samgong evaluation (prototype rules — adjust if you have specific rules)
/// Implemented:
/// - Three-of-a-kind => "Samgong (Triple)" (highest)
/// - Three-face (all J/Q/K) => "Samgong (Face)" (next)
/// - Otherwise: return rank-sum modulo 10 as simple score (and show high card tie-breaker)
class _GameSamgongScreenState extends State<GameSamgongScreen> {
  final Random _rng = Random();
  List<int> hand = [];
  String result = '';

  int _rankIndex(int cardIndex) => cardIndex % 13;
  String _rankStr(int id) {
    final ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
    return ranks[id % 13];
  }

  void draw() {
    List<int> deck = List<int>.generate(52, (i) => i);
    deck.shuffle(_rng);
    final h = deck.sublist(0, 3);
    setState(() {
      hand = h;
      result = evaluate(h);
    });
  }

  String evaluate(List<int> h) {
    final ranks = h.map((c) => _rankIndex(c)).toList();
    // three-of-a-kind (all same rank)
    if (ranks[0] == ranks[1] && ranks[1] == ranks[2]) return 'Samgong (Triple)';
    // three-face (all J/Q/K)
    final allFace = ranks.every((r) => r >= 10);
    if (allFace) return 'Samgong (Face)';
    // fallback: compute score based on rank indices (A treated as 1)
    final values = ranks.map((r) => (r == 0) ? 1 : (r + 1)).toList();
    final sum = values.reduce((a, b) => a + b);
    final score = sum % 10;
    return 'Score: $score (high card: ${_rankStr(ranks.reduce(max))})';
  }

  Widget _cardView(int id) {
    final suits = ['♠','♥','♦','♣'];
    final suit = suits[id % 4];
    final rank = _rankStr(id);
    return Container(
      margin: EdgeInsets.symmetric(horizontal: 6),
      padding: EdgeInsets.all(12),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8)),
      child: Column(children: [Text(rank, style: TextStyle(fontWeight: FontWeight.bold)), Text(suit)]),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Samgong — Optimized Demo'),
      ),
      body: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          children: [
            Text('Samgong demo: 3 kartu. Three-of-a-kind dan Three-face dideteksi. Lainnya gunakan score sederhana.', style: TextStyle(fontSize: 16)),
            SizedBox(height: 12),
            if (hand.isNotEmpty)
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: hand.map((c) => _cardView(c)).toList(),
              ),
            SizedBox(height: 12),
            Text(result, style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            Spacer(),
            ElevatedButton(onPressed: draw, child: Text('Draw 3 Kartu')),
          ],
        ),
      ),
    );
  }
}