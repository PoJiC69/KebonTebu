import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/socket_service.dart';

class LobbyScreen extends StatefulWidget {
  @override
  _LobbyScreenState createState() => _LobbyScreenState();
}

class _LobbyScreenState extends State<LobbyScreen> {
  final _roomNameCtrl = TextEditingController();

  @override
  Widget build(BuildContext context) {
    final socket = Provider.of<SocketService>(context);
    return Scaffold(
      appBar: AppBar(title: Text('Lobby'), actions: [
        IconButton(icon: Icon(Icons.account_balance_wallet), onPressed: () {
          Navigator.pushNamed(context, '/wallet');
        }),
      ]),
      body: Padding(
        padding: EdgeInsets.all(12),
        child: Column(
          children: [
            Text('Welcome, ${socket.username ?? 'guest'}'),
            SizedBox(height: 12),
            Row(children: [
              Expanded(child: TextField(controller: _roomNameCtrl, decoration: InputDecoration(labelText: 'Room name'))),
              SizedBox(width: 8),
              ElevatedButton(onPressed: () {
                socket.createRoom(_roomNameCtrl.text.trim());
                _roomNameCtrl.clear();
              }, child: Text('Create')),
            ]),
            SizedBox(height: 16),
            Expanded(
              child: socket.rooms.isEmpty
                ? Center(child: Text('No rooms yet'))
                : ListView.builder(
                    itemCount: socket.rooms.length,
                    itemBuilder: (_, i) {
                      final r = socket.rooms[i];
                      return Card(
                        child: ListTile(
                          title: Text(r['name'] ?? 'Room'),
                          subtitle: Text('Players: ${(r['players'] as List).length} — Host: ${r['host']}'),
                          trailing: ElevatedButton(
                            onPressed: () {
                              socket.joinRoom(r['id']);
                              Navigator.pushNamed(context, '/room', arguments: r['id']);
                            },
                            child: Text('Join'),
                          ),
                        ),
                      );
                    },
                  ),
            )
          ],
        ),
      ),
    );
  }
}