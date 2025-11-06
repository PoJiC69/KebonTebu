import 'package:flutter/material.dart';

class GameCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const GameCard({
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(colors: [Color(0xFF2B1055), Color(0xFF2F0743)]),
          borderRadius: BorderRadius.circular(16),
          boxShadow: [BoxShadow(color: Colors.black45, blurRadius: 8, offset: Offset(0,4))],
        ),
        padding: EdgeInsets.all(16),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.casino, size: 48, color: Colors.amberAccent),
            SizedBox(height: 12),
            Text(title, style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            SizedBox(height: 6),
            Text(subtitle, style: TextStyle(color: Colors.white70)),
          ],
        ),
      ),
    );
  }
}