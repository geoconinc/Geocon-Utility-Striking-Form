# Geocon Utility Strike Reporting Form

Form for field technicians to report utility strikes. Submissions are sent by email (SMTP) to the configured recipients, with form data and photo attachments.

---

## Live site

- **Hosted on:** [Netlify](https://www.netlify.com/)
- **Form URL:** [https://geoconutilitystrikeform.netlify.app](https://geoconutilitystrikeform.netlify.app)
- **Netlify dashboard:** [https://app.netlify.com/projects/geoconutilitystrikeform/overview](https://app.netlify.com/projects/geoconutilitystrikeform/overview) — deploy status, env vars, function logs

The form link is available 24/7. Technicians can open it on any device (phone, tablet, laptop) and submit reports without signing in.

---

## How it works

1. User fills out the form and can attach photos (before/after).
2. On submit, a Netlify serverless function runs and sends one email via SMTP.
3. The email goes to `EMAIL_TO` (and optionally `LEGAL_EMAIL`) with all form fields in the body and photos as attachments.
4. No database — email is the record.

---

## Deploy (Netlify)

1. Connect this repo to Netlify.  
   **Publish directory:** `.` · **Build command:** _(leave empty)_ · **Functions:** `netlify/functions`
2. In **Site settings → Environment variables**, set:
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
   - `EMAIL_TO` (required), `LEGAL_EMAIL` (optional)
   - Optionally: `MAX_IMAGE_SIZE_MB` (default 20)
3. Deploy. The form is live at your Netlify URL.

See **NETLIFY.md** for full deploy and env details.

---

## Local development

- **With Netlify CLI:** `npm install` then `netlify dev` (uses `.env` if present).
- **With Express:** Copy `.env.example` to `.env`, set SMTP and `EMAIL_TO`, then `npm start` and open `http://localhost:3000`.

---

## QR codes

The QR codes in this directory were created with [QRCode Monkey](https://www.qrcode-monkey.com/) — a free QR code generator that supports custom logos and high-resolution download.

## Repository

- **Source:** This GitHub repo (Geocon-Utility-Striking-Form)
- **Stack:** Static HTML/CSS/JS + Netlify Functions (Node) + Nodemailer (SMTP)
