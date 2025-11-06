import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/socket_service.dart';

class RoomScreen extends StatefulWidget {
  @override
  _RoomScreenState createState() => _RoomScreenState();
}

class _RoomScreenState extends State<RoomScreen> {
  String? roomId;
  final _betCtrl = TextEditingController();

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    roomId = ModalRoute.of(context)!.settings.arguments as String?;
    final socket = Provider.of<SocketService>(context, listen: false);
    if (roomId != null) socket.joinRoom(roomId!);
  }

  @override
  void dispose() {
    _betCtrl.dispose();
    super.dispose();
  }

  Widget _renderResults(Map<String, dynamic>? result, String type) {
    if (result == null) return SizedBox.shrink();
    final winners = List<String>.from(result['winners'] ?? []);
    final dealsMap = Map<String, dynamic>.from(result['deals'] ?? {});
    final payouts = Map<String, dynamic>.from(result['payouts'] ?? {});
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('$type Result', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        SizedBox(height: 8),
        ...dealsMap.entries.map((e) {
          final player = e.key;
          final hand = List<String>.from(e.value);
          final eval = (result['evaluations'] ?? {})[player] ?? {};
          final isWinner = winners.contains(player);
          final payout = payouts[player] ?? 0;
          return Card(
            color: isWinner ? Colors.green.shade700 : null,
            child: ListTile(
              title: Text(player),
              subtitle: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Hand: ${hand.join('  ')}'),
                  Text('Eval: ${eval['label'] ?? eval.toString()}'),
                  Text('Payout: $payout'),
                ],
              ),
              trailing: isWinner ? Icon(Icons.emoji_events, color: Colors.amber) : null,
            ),
          );
        }).toList(),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final socket = Provider.of<SocketService>(context);
    final room = socket.currentRoom;
    final poker = socket.pokerResult;
    final qiuqiu = socket.qiuqiuResult;
    final samgong = socket.samgongResult;
    final deals = socket.latestDeals;

    final isHost = room != null && room['host'] == socket.username;

    return Scaffold(
      appBar: AppBar(title: Text(room != null ? room['name'] : 'Room')),
      body: Padding(
        padding: EdgeInsets.all(12),
        child: Column(
          children: [
            Text('Saldo Anda: ${socket.demoBalance}', style: TextStyle(fontWeight: FontWeight.bold)),
            SizedBox(height: 8),
            if (room != null) Text('Players: ${(room['players'] as List).join(', ')}'),
            SizedBox(height: 12),

            // Bet input
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _betCtrl,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(labelText: 'Bet amount (demo)'),
                  ),
                ),
                SizedBox(width: 8),
                ElevatedButton(
                  onPressed: () {
                    final amt = int.tryParse(_betCtrl.text.trim()) ?? 0;
                    if (amt > 0 && roomId != null) {
                      socket.placeBet(roomId!, amt);
                      _betCtrl.clear();
                    } else {
                      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Enter valid amount')));
                    }
                  },
                  child: Text('Place Bet'),
                ),
              ],
            ),

            SizedBox(height: 12),

            // Room players + bets
            if (room != null)
              Expanded(
                child: ListView(
                  children: (room['players'] as List).map<Widget>((p) {
                    final bets = Map<String, dynamic>.from(room['bets'] ?? {});
                    final betAmt = bets[p] ?? 0;
                    return Card(
                      child: ListTile(
                        title: Text(p, style: TextStyle(fontWeight: FontWeight.bold)),
                        subtitle: Text('Bet: $betAmt'),
                      ),
                    );
                  }).toList(),
                ),
              )
            else Expanded(child: Center(child: Text('Waiting for players...'))),

            SizedBox(height: 12),

            // Buttons: host-only
            if (isHost)
              Column(
                children: [
                  ElevatedButton(
                    onPressed: () {
                      if (roomId != null) socket.startPoker(roomId!);
                    },
                    child: Text('Start Poker (settle bets)'),
                  ),
                  SizedBox(height: 8),
                  ElevatedButton(
                    onPressed: () {
                      if (roomId != null) socket.startQiuQiu(roomId!);
                    },
                    child: Text('Start Qiu Qiu (settle bets)'),
                  ),
                  SizedBox(height: 8),
                  ElevatedButton(
                    onPressed: () {
                      if (roomId != null) socket.startSamgong(roomId!);
                    },
                    child: Text('Start Samgong (settle bets)'),
                  ),
                ],
              ),

            SizedBox(height: 12),

            // Results (poker/qiuqiu/samgong)
            if (poker != null) _renderResults(poker, 'Poker'),
            if (qiuqiu != null) _renderResults(qiuqiu, 'QiuQiu'),
            if (samgong != null) _renderResults(samgong, 'Samgong'),

            SizedBox(height: 12),

            OutlinedButton(
              onPressed: () {
                if (roomId != null) {
                  socket.leaveRoom(roomId!);
                  Navigator.pop(context);
                }
              },
              child: Text('Leave Room'),
            )
          ],
        ),
      ),
    );
  }
}