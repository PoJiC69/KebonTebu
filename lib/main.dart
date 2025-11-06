import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'services/socket_service.dart';
import 'screens/home_screen.dart';
import 'screens/login_screen.dart';
import 'screens/wallet_screen.dart';
import 'screens/lobby_screen.dart';
import 'screens/room_screen.dart';
import 'screens/game_poker.dart';
import 'screens/game_qiuqiu.dart';
import 'screens/game_samgong.dart';
import 'screens/game_togel.dart';

void main() {
  runApp(KeBonTebuApp());
}

class KeBonTebuApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    // set server base: for Android emulator use 10.0.2.2, for iOS simulator localhost, for web use actual host
    final serverBase = 'http://10.0.2.2:3000'; // adjust when running on different platform

    return ChangeNotifierProvider(
      create: (_) => SocketService(serverBase: serverBase),
      child: MaterialApp(
        title: 'KEBONTEBU Casino',
        debugShowCheckedModeBanner: false,
        theme: ThemeData.dark().copyWith(textTheme: GoogleFonts.poppinsTextTheme()),
        initialRoute: '/login',
        routes: {
          '/login': (_) => LoginScreen(),
          '/lobby': (_) => LobbyScreen(),
          '/wallet': (_) => WalletScreen(),
          '/room': (_) => RoomScreen(),
          '/': (_) => HomeScreen(),
          '/poker': (_) => GamePokerScreen(),
          '/qiuqiu': (_) => GameQiuqiuScreen(),
          '/samgong': (_) => GameSamgongScreen(),
          '/togel': (_) => GameTogelScreen(),
        },
      ),
    );
  }
}