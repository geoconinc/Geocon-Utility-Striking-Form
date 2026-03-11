# Geocon Utility Strike Reporting Form

Static form that submits to a backend and sends an email (SMTP) with form data and photo attachments to the configured recipients (e.g. legal).

## Deploy (Netlify)

1. Connect this repo to Netlify. Publish directory: **`.`**. Build command: leave empty. Functions: **netlify/functions**.
2. Set **Environment variables** in Netlify (Site settings → Environment variables):
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
   - `EMAIL_TO` (required), `LEGAL_EMAIL` (optional)
3. Deploy. Form is live at your Netlify URL.

See **NETLIFY.md** for more detail.

## Local

- **With Netlify:** `npm install` then `netlify dev` (uses `.env` if present).
- **With Express:** copy `.env.example` to `.env`, fill in SMTP and `EMAIL_TO`, then `npm start` and open `http://localhost:3000`.
