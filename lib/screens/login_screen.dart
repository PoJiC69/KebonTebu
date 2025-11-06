import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/socket_service.dart';

class LoginScreen extends StatefulWidget {
  @override
  _LoginScreenState createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _userCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  bool loading = false;
  String? error;

  @override
  void dispose() {
    _userCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final socket = Provider.of<SocketService>(context, listen: false);
    return Scaffold(
      appBar: AppBar(title: Text('Login (Demo)')),
      body: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          children: [
            Text('Masuk dengan username & password (demo). Signup tersedia via server API.', style: TextStyle(fontSize: 14)),
            SizedBox(height: 12),
            TextField(controller: _userCtrl, decoration: InputDecoration(labelText: 'Username')),
            SizedBox(height: 8),
            TextField(controller: _passCtrl, decoration: InputDecoration(labelText: 'Password'), obscureText: true),
            SizedBox(height: 12),
            if (error != null) Text(error!, style: TextStyle(color: Colors.red)),
            SizedBox(height: 12),
            ElevatedButton(
              onPressed: loading ? null : () async {
                setState(() { loading = true; error = null; });
                try {
                  final ok = await socket.login(_userCtrl.text.trim(), _passCtrl.text);
                  if (ok) {
                    Navigator.pushReplacementNamed(context, '/lobby');
                  } else {
                    setState(() { error = 'Login gagal (cek credentials)'; });
                  }
                } catch (e) {
                  setState(() { error = 'Error: $e'; });
                } finally {
                  setState(() { loading = false; });
                }
              },
              child: Text('Login'),
            ),
            SizedBox(height: 12),
            TextButton(
              onPressed: () {
                _userCtrl.text = 'guest${DateTime.now().millisecondsSinceEpoch % 1000}';
                _passCtrl.text = 'password';
              },
              child: Text('Generate guest cred (username/password)'),
            )
          ],
        ),
      ),
    );
  }
}