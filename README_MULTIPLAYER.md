```markdown
# KEBONTEBU Multiplayer Prototype (server + Flutter client)

Instruksi singkat menjalankan prototype ini (lokal):

1) Server (Node.js + Socket.IO)
- Pastikan Node.js terpasang (v14+).
- Masuk ke folder `server/`.
- Jalankan:
  - npm install
  - npm start
- Server default mendengarkan di http://localhost:3000

Catatan: Jika Anda menjalankan Android emulator, client Flutter harus menghubungi `http://10.0.2.2:3000`. Untuk iOS simulator gunakan `http://localhost:3000`. Untuk web, gunakan `http://localhost:3000` atau alamat mesin Anda.

2) Flutter client
- Pastikan Flutter SDK terpasang.
- Di root project Flutter Anda, perbarui `pubspec.yaml` (lihat file yang disediakan).
- Jalankan:
  - flutter pub get
  - flutter run -d chrome (web) atau flutter run (device)
- Pada `lib/main.dart` set `serverBase` sesuai platform:
  - Android emulator: http://10.0.2.2:3000
  - iOS simulator: http://localhost:3000
  - Web: http://localhost:3000 (atau http://YOUR_MACHINE_IP:3000)

3) Flow:
- Buka app → Login (pakai username apa saja, demo).
- Menu Lobby: buat room / gabung room.
- Di dalam room, host dapat menekan "Start Poker" → server akan mengirim 'poker_deal' kepada semua pemain di room.
- Wallet: demo saldo lokal (SharedPreferences).

Legal & Safety:
- Ini prototype non‑uang. Jangan menyambungkan backend pembayaran atau menyimpan data sensitif di server ini.
```