# Geocon Reporting Forms

Forms for field staff to report a utility strike, a workplace injury, or offensive behavior. Submissions are sent by email (SMTP) to the configured recipients, with form data and photo attachments.

---

## Live site

- **Hosted on:** [Netlify](https://www.netlify.com/)
- **Form URL:** [https://geoconutilitystrikeform.netlify.app](https://geoconutilitystrikeform.netlify.app)
- **Netlify dashboard:** [https://app.netlify.com/projects/geoconutilitystrikeform/overview](https://app.netlify.com/projects/geoconutilitystrikeform/overview) — deploy status, env vars, function logs

The link is available 24/7. Staff can open it on any device (phone, tablet, laptop) and submit reports without signing in. The QR code points at the site root, which shows a menu of the three report types — so existing printed QR codes keep working.

---

## Report types

| Report | Page | Goes to |
| --- | --- | --- |
| Utility strike | `strike.html` | `EMAIL_TO` and `LEGAL_EMAIL` |
| Injury / accident and illness | `injury.html` | `HR_EMAIL_TO`, plus the manager named on the form |
| Offensive behavior | `offensive.html` | `HR_EMAIL_TO` |

The utility strike form is self-contained: `script.js` and `netlify/functions/submit.js` serve only that form and are not shared with the other two, which run through `report.js` and `netlify/functions/submit-report.js`.

---

## How it works

1. User fills out a form and can attach photos.
2. On submit, a Netlify serverless function runs and sends one email via SMTP with all fields in the body and photos as attachments.
3. No database — email is the record.

### The injury form's two stages

An injury report reaches HR twice, because the investigation half is the manager's job and shouldn't delay HR seeing the incident:

1. The employee files the report and names their manager. HR and the manager both get an email subject-lined **"Initial, investigation pending"**.
2. That email contains a **Complete this report** button. The employee's answers and photos are saved to [Netlify Blobs](https://docs.netlify.com/build/data-and-storage/netlify-blobs/) under a random id that the button's link carries, so the manager's form opens already filled in — they only add the Supervisor / Investigation section.
3. On that second submit, HR gets a **"Completed"** email containing both halves, with the employee's original photos re-attached. The saved copy is then deleted.

Netlify provisions blob storage automatically, so there is nothing to configure. If it is ever unavailable the report still emails normally; the manager's form just opens blank. Unfinished reports are discarded after `DRAFT_RETENTION_DAYS` (default 90).

---

## Deploy (Netlify)

1. Connect this repo to Netlify.  
   **Publish directory:** `.` · **Build command:** _(leave empty)_ · **Functions:** `netlify/functions`
2. In **Site settings → Environment variables**, set:
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
   - `EMAIL_TO` (required), `LEGAL_EMAIL` (optional) — utility strike recipients
   - `HR_EMAIL_TO` — injury and offensive behavior recipients, comma-separated for more than one
   - Optionally: `MAX_IMAGE_SIZE_MB` (default 20), `DRAFT_RETENTION_DAYS` (default 90), `SITE_URL` (only if the site is served from somewhere other than its Netlify URL)
3. Deploy. The forms are live at your Netlify URL.

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
