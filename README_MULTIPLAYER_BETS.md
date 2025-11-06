```markdown
# Bets & Settlement — KEBONTEBU Prototype

Flow singkat:
- Setiap user login mendapat saldo demo (default 1000).
- Di dalam room, pemain dapat mengirim 'place_bet' (tombol Place Bet di UI) — saldo dikurangi segera setelah bet diterima.
- Host memicu 'Start Poker' → server deal & evaluate, tentukan pemenang(s), hitung pot = sum semua bets.
- Pot dibagi rata ke pemenang (integer share), saldo pemenang ditambah.
- Server mengemit 'poker_result' (deals, evaluations, winners, payouts) dan 'balance_update' per user.

Endpoints:
- POST /auth/login { username }
- GET /wallet/:username
- POST /wallet/topup { username, amount }  (demo top-up)

Catatan:
- Semua state masih in-memory. Untuk prototype multi-user across restarts gunakan DB.
- Ini demo non-uang.
```