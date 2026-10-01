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
| Injury / accident and illness | `injury.html` | the manager named on the form, then `HR_EMAIL_TO` once the investigation is attached |
| Offensive behavior | `offensive.html` | `HR_EMAIL_TO` |

The utility strike form is self-contained: `script.js` and `netlify/functions/submit.js` serve only that form and are not shared with the other two, which run through `report.js` and `netlify/functions/submit-report.js`.

---

## How it works

1. User fills out a form and can attach photos.
2. On submit, a Netlify serverless function runs and sends one email via SMTP with all fields in the body and photos as attachments.
3. No database — email is the record.

### The injury form's two stages

An injury report is filled in by two people, and **HR only receives it once it is complete**:

1. The employee files the report and names their manager. **Only the manager** is emailed, subject-lined *"Action needed: complete the injury report for …"*. HR is not on this email.
2. That email contains a **Complete this report** button. The employee's answers and photos are saved to Azure under a random id the button's link carries, so the manager's form opens already filled in — they only add the Supervisor / Investigation section.
3. On that submit, HR gets a single *"Injury Report – …"* email containing both halves, with the employee's original photos attached. The saved copy is deleted immediately afterwards.

Because HR is not on the first email, the manager's address is required — without it the report would reach nobody, so a filing without one is rejected rather than silently going nowhere.

> **Worth knowing:** nobody outside the manager learns of an injury until they complete the investigation. If a manager sits on it, HR finds out late, which matters against the Cal/OSHA serious-injury reporting window and the workers' comp DWC-1 clock. Routing the first email to HR as well would remove that risk at the cost of them receiving two emails per injury.

Storage is treated as a convenience, never a dependency: every draft operation is capped at `DRAFT_TIMEOUT_MS` (default 3000) and failures are logged and stepped over. If Azure is slow or unreachable the report still emails the manager normally; their form just opens blank and the email says so. Anything left unfinished expires after `DRAFT_RETENTION_DAYS` (default 90).

### Storage (Azure)

Injury details are held in Geocon's own Azure tenant rather than a third party.

| | |
| --- | --- |
| Storage account | `geoconhrreports` |
| Resource group | `Geocon-HR-Reports` (subscription `GeoconAzure`, West US) |
| Container | `injury-drafts`, created automatically on first use |

Each draft is a small JSON record plus one binary blob per photo:

```
<id>.json   the answers, and the filename of each photo
<id>/0      the first photo, exactly as uploaded
<id>/1      ...
```

Photos are deliberately kept out of the record. Base64-encoding them into it would inflate them by a third, and prefilling the manager's form — which only shows text — would have to download every image byte just to discard it. This way prefill reads under a kilobyte, and the photos are fetched once, when the completed report is built.

The account is dedicated to HR reporting rather than shared with another system, so its access can be granted and revoked without touching anything else. It is configured with anonymous blob access disabled, HTTPS required, TLS 1.2 minimum, and blob soft delete reduced from the 7-day default to 1 day.

Treat the access keys as sensitive: anyone holding the connection string can read every pending injury report, which contains medical information. A draft's real lifetime is `DRAFT_RETENTION_DAYS` plus the 1-day soft-delete window.

---

## Deploy (Netlify)

1. Connect this repo to Netlify.  
   **Publish directory:** `.` · **Build command:** _(leave empty)_ · **Functions:** `netlify/functions`
2. In **Site settings → Environment variables**, set:
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
   - `EMAIL_TO` (required), `LEGAL_EMAIL` (optional) — utility strike recipients
   - `HR_EMAIL_TO` — injury and offensive behavior recipients, comma-separated for more than one
   - `AZURE_STORAGE_CONNECTION_STRING` — from the storage account's **Access keys** page in the Azure portal. Without it the injury form still works; the manager's form just won't prefill.
   - Optionally: `AZURE_STORAGE_CONTAINER` (default `injury-drafts`), `MAX_IMAGE_SIZE_MB` (default 20), `DRAFT_RETENTION_DAYS` (default 90), `DRAFT_TIMEOUT_MS` (default 3000), `SITE_URL` (only if the site is served from somewhere other than its Netlify URL)
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
