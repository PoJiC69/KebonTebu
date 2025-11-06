import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class WalletScreen extends StatefulWidget {
  @override
  _WalletScreenState createState() => _WalletScreenState();
}

class _WalletScreenState extends State<WalletScreen> {
  int balance = 1000;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final sp = await SharedPreferences.getInstance();
    setState(() { balance = sp.getInt('demo_balance') ?? 1000; });
  }

  Future<void> _setBalance(int b) async {
    final sp = await SharedPreferences.getInstance();
    await sp.setInt('demo_balance', b);
    setState(() { balance = b; });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Wallet (Demo)')),
      body: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          children: [
            Text('Saldo demo:', style: TextStyle(fontSize: 16)),
            SizedBox(height: 12),
            Text('Rp $balance', style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold)),
            SizedBox(height: 24),
            ElevatedButton(
              onPressed: () => _setBalance(balance + 1000),
              child: Text('Top-up +1000 (demo)'),
            ),
            SizedBox(height: 12),
            OutlinedButton(
              onPressed: () => _setBalance(1000),
              child: Text('Reset 1000'),
            ),
          ],
        ),
      ),
    );
  }
}