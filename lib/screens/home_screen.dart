import 'package:flutter/material.dart';
import '../widgets/game_card.dart';

class HomeScreen extends StatelessWidget {
  final List<Map<String, String>> games = [
    {'route': '/poker', 'title': 'Poker', 'subtitle': 'Texas-style demo'},
    {'route': '/qiuqiu', 'title': 'Qiu Qiu', 'subtitle': 'Showdown 3-card'},
    {'route': '/samgong', 'title': 'Samgong', 'subtitle': '3-card special'},
    {'route': '/togel', 'title': 'Togel 12-digit', 'subtitle': 'Masukkan angka 12-digit'},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('KEBONTEBU', style: TextStyle(letterSpacing: 2)),
        centerTitle: true,
        elevation: 0,
        backgroundColor: Colors.transparent,
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: GridView.count(
          crossAxisCount: (MediaQuery.of(context).size.width > 800) ? 4 : 2,
          crossAxisSpacing: 16,
          mainAxisSpacing: 16,
          children: games.map((g) {
            return GameCard(
              title: g['title']!,
              subtitle: g['subtitle']!,
              onTap: () => Navigator.pushNamed(context, g['route']!),
            );
          }).toList(),
        ),
      ),
    );
  }
}