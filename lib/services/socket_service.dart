// lib/services/socket_service.dart
import 'dart:convert';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class SocketService extends ChangeNotifier {
  IO.Socket? socket;
  String? username;
  String? serverBase; // e.g. http://10.0.2.2:3000 or https://your.domain.tld
  String? accessToken;
  String? refreshToken;

  List<Map<String, dynamic>> rooms = [];
  Map<String, dynamic>? currentRoom;
  Map<String, List<String>> latestDeals = {};
  Map<String, dynamic>? pokerResult;
  Map<String, dynamic>? qiuqiuResult;
  Map<String, dynamic>? samgongResult;
  int demoBalance = 0;

  SocketService({this.serverBase});

  Future<void> loadSavedTokens() async {
    final sp = await SharedPreferences.getInstance();
    accessToken = sp.getString('access_token');
    refreshToken = sp.getString('refresh_token');
    if (accessToken != null) connect(accessToken!);
  }

  Future<void> saveTokens(String access, String? refresh) async {
    final sp = await SharedPreferences.getInstance();
    await sp.setString('access_token', access);
    if (refresh != null) await sp.setString('refresh_token', refresh);
    accessToken = access;
    refreshToken = refresh;
  }

  Future<bool> signup(String username, String password, String adminToken) async {
    if (serverBase == null) throw Exception('serverBase not set');
    final resp = await http.post(Uri.parse('$serverBase/auth/signup'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'username': username, 'password': password, 'admin_token': adminToken}));
    if (resp.statusCode == 200) {
      final body = jsonDecode(resp.body);
      this.username = body['username'];
      final access = body['access_token'] ?? body['token'];
      final refresh = body['refresh_token'];
      await saveTokens(access, refresh);
      connect(access);
      demoBalance = body['balance'] ?? demoBalance;
      notifyListeners();
      return true;
    }
    return false;
  }

  Future<bool> login(String usernameParam, String password) async {
    if (serverBase == null) throw Exception('serverBase not set');
    final resp = await http.post(Uri.parse('$serverBase/auth/login'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'username': usernameParam, 'password': password}));
    if (resp.statusCode == 200) {
      final body = jsonDecode(resp.body);
      this.username = body['username'];
      final access = body['access_token'] ?? body['token'];
      final refresh = body['refresh_token'];
      await saveTokens(access, refresh);
      connect(access);
      demoBalance = body['balance'] ?? demoBalance;
      notifyListeners();
      return true;
    }
    return false;
  }

  Future<bool> attemptRefresh() async {
    if (refreshToken == null || serverBase == null) return false;
    try {
      final resp = await http.post(Uri.parse('$serverBase/auth/refresh'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'refresh_token': refreshToken}));
      if (resp.statusCode == 200) {
        final b = jsonDecode(resp.body);
        await saveTokens(b['access_token'], b['refresh_token']);
        return true;
      }
    } catch (e) {
      print('refresh error $e');
    }
    return false;
  }

  void connect(String token) {
    if (socket != null) return;
    socket = IO.io(
      serverBase,
      IO.OptionBuilder()
          .setTransports(['websocket'])
          .enableForceNew()
          .enableReconnection()
          .build(),
    );

    socket!.onConnect((_) {
      print('socket connected');
      socket!.emit('auth', token);
      if (currentRoom != null && currentRoom!['id'] != null) {
        socket!.emit('join_room', { 'roomId': currentRoom!['id'] });
      }
    });

    socket!.on('lobby_rooms', (data) {
      rooms = List<Map<String, dynamic>>.from(data.map((r) => Map<String, dynamic>.from(r)));
      notifyListeners();
    });

    socket!.on('room_update', (data) {
      currentRoom = Map<String, dynamic>.from(data);
      notifyListeners();
    });

    socket!.on('poker_result', (data) {
      try {
        pokerResult = Map<String, dynamic>.from(data);
        if (data['deals'] != null) {
          latestDeals = Map<String, List<String>>.from(data['deals'].map((k,v) => MapEntry(k, List<String>.from(v))));
        }
        notifyListeners();
      } catch (e) {
        print('poker_result parsing error: $e');
      }
    });

    socket!.on('qiuqiu_result', (data) {
      try {
        qiuqiuResult = Map<String, dynamic>.from(data);
        if (data['deals'] != null) {
          latestDeals = Map<String, List<String>>.from(data['deals'].map((k,v) => MapEntry(k, List<String>.from(v))));
        }
        notifyListeners();
      } catch (e) {
        print('qiuqiu_result parsing error: $e');
      }
    });

    socket!.on('samgong_result', (data) {
      try {
        samgongResult = Map<String, dynamic>.from(data);
        if (data['deals'] != null) {
          latestDeals = Map<String, List<String>>.from(data['deals'].map((k,v) => MapEntry(k, List<String>.from(v))));
        }
        notifyListeners();
      } catch (e) {
        print('samgong_result parsing error: $e');
      }
    });

    socket!.on('balance_update', (data) {
      try {
        final d = Map<String, dynamic>.from(data);
        if (d['username'] == username) {
          demoBalance = (d['balance'] ?? demoBalance);
        }
        notifyListeners();
      } catch (e) {
        print('balance_update parse error: $e');
      }
    });

    socket!.on('error', (data) async {
      try {
        if (data is Map && (data['message'] == 'auth failed' || data['message'] == 'invalid token')) {
          final ok = await attemptRefresh();
          if (ok && accessToken != null) {
            socket!.disconnect();
            socket = null;
            connect(accessToken!);
          }
        }
      } catch (e) { print('socket error handler: $e'); }
    });

    socket!.onDisconnect((_) {
      print('socket disconnected');
    });
  }

  void createRoom(String roomName) {
    socket?.emit('create_room', {'roomName': roomName});
  }

  void joinRoom(String roomId) {
    socket?.emit('join_room', {'roomId': roomId});
  }

  void leaveRoom(String roomId) {
    socket?.emit('leave_room', {'roomId': roomId});
    currentRoom = null;
    pokerResult = null;
    qiuqiuResult = null;
    samgongResult = null;
    notifyListeners();
  }

  void placeBet(String roomId, int amount) {
    socket?.emit('place_bet', {'roomId': roomId, 'amount': amount});
  }

  void startPoker(String roomId) {
    socket?.emit('start_game_poker', {'roomId': roomId});
  }

  void startQiuQiu(String roomId) {
    socket?.emit('start_game_qiuqiu', {'roomId': roomId});
  }

  void startSamgong(String roomId) {
    socket?.emit('start_game_samgong', {'roomId': roomId});
  }

  Future<void> logout() async {
    final sp = await SharedPreferences.getInstance();
    await sp.remove('access_token');
    await sp.remove('refresh_token');
    accessToken = null;
    refreshToken = null;
    username = null;
    demoBalance = 0;
    if (socket != null) {
      socket!.disconnect();
      socket = null;
    }
    notifyListeners();
  }

  void disposeSocket() {
    socket?.disconnect();
    socket = null;
  }
}