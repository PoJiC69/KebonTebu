import 'dart:math';
import 'package:flutter/material.dart';

class GamePokerScreen extends StatefulWidget {
  @override
  _GamePokerScreenState createState() => _GamePokerScreenState();
}

/// Helper structures for poker evaluation
enum PokerHandRank {
  highCard,
  pair,
  twoPair,
  threeOfKind,
  straight,
  flush,
  fullHouse,
  fourOfKind,
  straightFlush,
}

class PokerEvaluation {
  final PokerHandRank rank;
  final List<int> tiebreakers; // list of rank values in descending order for tie-breaker

  PokerEvaluation(this.rank, this.tiebreakers);
}

class _GamePokerScreenState extends State<GamePokerScreen> {
  final Random _rng = Random();
  List<String> player = [];
  List<String> dealer = [];
  String resultText = '';

  final List<String> deck = [
    for (var s in ['♠', '♥', '♦', '♣'])
      for (var r in ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'])
        '$r$s'
  ];

  static const Map<String, int> rankValue = {
    '2': 2,
    '3': 3,
    '4': 4,
    '5': 5,
    '6': 6,
    '7': 7,
    '8': 8,
    '9': 9,
    '10': 10,
    'J': 11,
    'Q': 12,
    'K': 13,
    'A': 14,
  };

  void deal() {
    final d = List<String>.from(deck);
    d.shuffle(_rng);
    setState(() {
      player = d.sublist(0, 5);
      dealer = d.sublist(5, 10);
      final evalP = evaluateHand(player);
      final evalD = evaluateHand(dealer);
      final cmp = compareEvaluations(evalP, evalD);
      if (cmp > 0) {
        resultText = 'Player menang — ${prettyRank(evalP)}';
      } else if (cmp < 0) {
        resultText = 'Dealer menang — ${prettyRank(evalD)}';
      } else {
        resultText = 'Imbang — ${prettyRank(evalP)}';
      }
    });
  }

  String prettyRank(PokerEvaluation e) {
    switch (e.rank) {
      case PokerHandRank.straightFlush:
        return 'Straight Flush';
      case PokerHandRank.fourOfKind:
        return 'Four of a Kind';
      case PokerHandRank.fullHouse:
        return 'Full House';
      case PokerHandRank.flush:
        return 'Flush';
      case PokerHandRank.straight:
        return 'Straight';
      case PokerHandRank.threeOfKind:
        return 'Three of a Kind';
      case PokerHandRank.twoPair:
        return 'Two Pair';
      case PokerHandRank.pair:
        return 'Pair';
      case PokerHandRank.highCard:
      default:
        return 'High Card';
    }
  }

  PokerEvaluation evaluateHand(List<String> hand) {
    // parse ranks and suits
    final ranks = hand.map((c) {
      final r = c.substring(0, c.length - 1);
      return rankValue[r]!;
    }).toList();
    final suits = hand.map((c) => c.substring(c.length - 1)).toList();

    ranks.sort();
    // Count occurrences of each rank
    final Map<int, int> counts = {};
    for (final r in ranks) counts[r] = (counts[r] ?? 0) + 1;

    final List<int> distinctRanksDesc = counts.keys.toList()..sort((a, b) => b.compareTo(a));
    // check flush
    final isFlush = suits.toSet().length == 1;

    // check straight (handle wheel A-2-3-4-5)
    bool isStraight = false;
    List<int> straightRanks = List<int>.from(ranks);
    straightRanks.sort();
    // normal straight
    bool normalStraight = true;
    for (int i = 0; i < 4; i++) {
      if (straightRanks[i + 1] != straightRanks[i] + 1) {
        normalStraight = false;
        break;
      }
    }
    // wheel straight (A,2,3,4,5)
    bool wheel = false;
    if (!normalStraight) {
      final s = straightRanks;
      if (s[0] == 2 && s[1] == 3 && s[2] == 4 && s[3] == 5 && s[4] == 14) {
        wheel = true;
      }
    }
    isStraight = normalStraight || wheel;

    // group by counts
    final countValues = counts.values.toList()..sort((a, b) => b.compareTo(a)); // e.g. [3,2] fullhouse

    if (isStraight && isFlush) {
      // straight flush; tiebreaker is highest card (wheel low treated as 5-high)
      final high = wheel ? 5 : ranks.reduce(max);
      return PokerEvaluation(PokerHandRank.straightFlush, [high]);
    }

    if (countValues[0] == 4) {
      // four of a kind
      final quadRank = counts.entries.firstWhere((e) => e.value == 4).key;
      final kicker = counts.entries.firstWhere((e) => e.value == 1).key;
      return PokerEvaluation(PokerHandRank.fourOfKind, [quadRank, kicker]);
    }

    if (countValues[0] == 3 && countValues.length > 1 && countValues[1] == 2) {
      // full house
      final three = counts.entries.firstWhere((e) => e.value == 3).key;
      final pair = counts.entries.firstWhere((e) => e.value == 2).key;
      return PokerEvaluation(PokerHandRank.fullHouse, [three, pair]);
    }

    if (isFlush) {
      // flush tiebreakers: sorted ranks desc
      final sortedDesc = List<int>.from(ranks)..sort((a, b) => b.compareTo(a));
      return PokerEvaluation(PokerHandRank.flush, sortedDesc);
    }

    if (isStraight) {
      final high = wheel ? 5 : ranks.reduce(max);
      return PokerEvaluation(PokerHandRank.straight, [high]);
    }

    if (countValues[0] == 3) {
      final three = counts.entries.firstWhere((e) => e.value == 3).key;
      final kickers = counts.entries.where((e) => e.value == 1).map((e) => e.key).toList()..sort((a, b) => b.compareTo(a));
      return PokerEvaluation(PokerHandRank.threeOfKind, [three, ...kickers]);
    }

    if (countValues[0] == 2 && countValues[1] == 2) {
      // two pair
      final pairs = counts.entries.where((e) => e.value == 2).map((e) => e.key).toList()..sort((a, b) => b.compareTo(a));
      final kicker = counts.entries.firstWhere((e) => e.value == 1).key;
      return PokerEvaluation(PokerHandRank.twoPair, [...pairs, kicker]);
    }

    if (countValues[0] == 2) {
      final pair = counts.entries.firstWhere((e) => e.value == 2).key;
      final kickers = counts.entries.where((e) => e.value == 1).map((e) => e.key).toList()..sort((a, b) => b.compareTo(a));
      return PokerEvaluation(PokerHandRank.pair, [pair, ...kickers]);
    }

    // high card
    final sortedDesc = List<int>.from(ranks)..sort((a, b) => b.compareTo(a));
    return PokerEvaluation(PokerHandRank.highCard, sortedDesc);
  }

  int compareEvaluations(PokerEvaluation a, PokerEvaluation b) {
    if (a.rank.index != b.rank.index) return a.rank.index.compareTo(b.rank.index);
    // same rank, compare tiebreakers lexicographically
    for (int i = 0; i < max(a.tiebreakers.length, b.tiebreakers.length); i++) {
      final av = i < a.tiebreakers.length ? a.tiebreakers[i] : 0;
      final bv = i < b.tiebreakers.length ? b.tiebreakers[i] : 0;
      if (av != bv) return av.compareTo(bv);
    }
    return 0;
  }

  Widget _handCardList(String label, List<String> hand) {
    return Column(
      children: [
        Text(label, style: TextStyle(fontWeight: FontWeight.bold)),
        SizedBox(height: 8),
        Container(
          padding: EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: Color(0xFF101017),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: hand.map((c) => _cardView(c)).toList(),
          ),
        )
      ],
    );
  }

  Widget _cardView(String code) {
    final suit = code.substring(code.length - 1);
    final rank = code.substring(0, code.length - 1);
    final isRed = suit == '♥' || suit == '♦';
    return Container(
      margin: EdgeInsets.symmetric(horizontal: 4),
      width: 48,
      height: 72,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Center(
        child: Text(
          '$rank\n$suit',
          textAlign: TextAlign.center,
          style: TextStyle(
            color: isRed ? Colors.red : Colors.black,
            fontWeight: FontWeight.bold,
            fontSize: 12,
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final playerEval = player.isNotEmpty ? evaluateHand(player) : null;
    final dealerEval = dealer.isNotEmpty ? evaluateHand(dealer) : null;

    return Scaffold(
      appBar: AppBar(
        title: Text('Poker — Optimized Demo'),
      ),
      body: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          children: [
            Text('Demo Poker: 5 kartu, evaluator lengkap & perbandingan tangan', style: TextStyle(fontSize: 16)),
            SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _handCardList('Player', player),
                _handCardList('Dealer', dealer),
              ],
            ),
            SizedBox(height: 12),
            if (playerEval != null) Text('Player: ${prettyRank(playerEval)}', style: TextStyle(fontWeight: FontWeight.bold)),
            if (dealerEval != null) Text('Dealer: ${prettyRank(dealerEval)}', style: TextStyle(fontWeight: FontWeight.bold)),
            SizedBox(height: 8),
            Text(resultText, style: TextStyle(fontSize: 16, color: Colors.amberAccent)),
            Spacer(),
            ElevatedButton.icon(
              onPressed: deal,
              icon: Icon(Icons.play_arrow),
              label: Text('Deal'),
              style: ElevatedButton.styleFrom(minimumSize: Size(200, 48)),
            )
          ],
        ),
      ),
    );
  }
}