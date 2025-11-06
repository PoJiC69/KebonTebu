import 'dart:math';
import 'package:flutter/material.dart';

class GameTogelScreen extends StatefulWidget {
  @override
  _GameTogelScreenState createState() => _GameTogelScreenState();
}

class _GameTogelScreenState extends State<GameTogelScreen> {
  final TextEditingController _ctrl = TextEditingController();
  String? result;
  String? drawNumber;

  void draw() {
    final rng = Random();
    String rnd = List.generate(12, (_) => rng.nextInt(10).toString()).join();
    setState(() {
      drawNumber = rnd;
      final ticket = _ctrl.text.trim();
      if (ticket.length == 12 && ticket == rnd) {
        result = 'MENANG! Nomor cocok';
      } else {
        result = 'Tidak cocok. Draw: $rnd';
      }
    });
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Togel 12-digit — Demo'),
      ),
      body: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          children: [
            Text('Masukkan tiket 12-digit dan tekan Draw. Ini demo lokal (random draw).', style: TextStyle(fontSize: 16)),
            SizedBox(height: 12),
            TextField(
              controller: _ctrl,
              keyboardType: TextInputType.number,
              maxLength: 12,
              decoration: InputDecoration(
                hintText: '012345678901',
                border: OutlineInputBorder(),
                labelText: 'Tiket 12-digit',
              ),
            ),
            SizedBox(height: 12),
            ElevatedButton(onPressed: draw, child: Text('Draw')),
            SizedBox(height: 20),
            if (result != null)
              Text(result!, style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            if (drawNumber != null && _ctrl.text.trim().length != 12)
              Text('Draw: $drawNumber', style: TextStyle(color: Colors.white70)),
          ],
        ),
      ),
    );
  }
}