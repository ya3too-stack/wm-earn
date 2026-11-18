# WM EARN — Telegram Mini App (Alpha)

A Telegram Mini App starter with a dark earning dashboard, server-verified Telegram login,
wallet ledger, daily bonus, referral links, task catalogue, and payout requests.

## Important boundaries
- Wallet balances and rewards in this alpha are **test credits**, not cash or a promise of earnings.
- Payout requests are recorded as `PENDING`; no bank/card transfer is executed.
- Do not enable real-money deposits, paid tasks, or withdrawals until you have a compliant
  payment provider, verified business details, published terms/privacy policy, fraud controls,
  and legal review for the countries where you operate.
- Never ask users to send full card numbers or CVV. This project stores no card data.
- Telegram identity is verified on the server from `initData`; do not trust client-supplied user IDs.

## Requirements
- Node.js 20+
- npm
- A Telegram bot created with BotFather
- PostgreSQL for production (SQLite is configured for local development)

## 1. Configure environment
Copy `server/.env.example` to `server/.env` and set:
- `BOT_TOKEN`: token from BotFather (keep secret)
- `WEBAPP_URL`: public HTTPS URL of the deployed client
- `DATABASE_URL`: SQLite locally or PostgreSQL in production
- `ADMIN_TELEGRAM_IDS`: comma-separated numeric Telegram IDs for administrators
- `APP_ORIGIN`: deployed client origin

## 2. Install and initialize
```bash
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```
Client: `http://localhost:5173`; API: `http://localhost:3001`.

For local browser-only development, set `ALLOW_DEV_AUTH=true` in `server/.env`.
This creates a clearly labelled local test account. It is not a Telegram login and must
never be enabled in production.

## 3. Connect Telegram
In BotFather:
1. Create a bot and keep its token private.
2. Configure the Mini App URL to your deployed HTTPS frontend URL.
3. Set the menu button / Main App URL to the same URL.
4. Open the app from the bot in Telegram. The Telegram Web App SDK provides `initData`,
   which the server validates using the bot token.

## 4. Deploy
Deploy the client as a static site and the server as a Node service. Use PostgreSQL.
Set `WEBAPP_URL` and `APP_ORIGIN` to the exact HTTPS frontend origin, run migrations,
and set `NODE_ENV=production`. Never expose `BOT_TOKEN` in frontend variables.

## Included alpha flows
- Telegram WebApp authentication (server-side HMAC + auth_date check)
- Wallet balance and immutable transaction history
- Daily check-in bonus (once per UTC day)
- Referral start parameter (`?startapp=ref_<telegramUserId>`)
- Task list and task claim endpoint with server-side reward credit
- Payout request records with minimum balance and pending status
- Admin-only task creation and payout status review endpoints

## Not included / requires external integration
- Actual ad/video verification or advertiser callbacks
- Real bank/card payouts, deposits, SMS verification, or payment processing
- Production anti-fraud / KYC / tax handling
- App Store packaging (this is a Telegram Mini App)

## Security checklist before public launch
- Use PostgreSQL, HTTPS, strong secrets, backups, rate limiting and monitoring.
- Set `ALLOW_DEV_AUTH=false`.
- Restrict admin IDs and protect administrator Telegram accounts with 2FA.
- Add legal terms, privacy notice, support contact, retention/deletion process.
- Integrate verified advertiser callbacks; do not reward merely because a timer elapsed.
- Have payment and compliance providers approve the business model before cash payouts.
