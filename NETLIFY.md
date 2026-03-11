# Deploying to Netlify

This project can be hosted on Netlify. The form submits to a serverless function that sends email (with photo attachments) to you and legal.

## Deploy steps

1. Push your repo to GitHub (e.g. under a Geocon org).
2. Sign in at [netlify.com](https://netlify.com) and click **Add new site** → **Import an existing project**.
3. Connect the GitHub repo. Netlify will use:
   - **Build command:** (leave empty)
   - **Publish directory:** `.` (root)
4. Before deploying, set **Environment variables** (Site settings → Environment variables). Add the same SMTP and email vars you use in `.env`:

   - `SMTP_HOST` (e.g. `smtp.office365.com`)
   - `SMTP_PORT` (e.g. `587`)
   - `SMTP_SECURE` (`false`)
   - `SMTP_USER` (your sending email)
   - `SMTP_PASS` (password or app password)
   - `SMTP_FROM` (same as SMTP_USER)
   - `EMAIL_TO` (e.g. `mundra@Geoconinc.com`)
   - `LEGAL_EMAIL` (optional; when set, legal gets the same email)

5. Deploy. Netlify will build and deploy the site and the `netlify/functions/submit` function.

## Local testing with Netlify

```bash
npm install
netlify dev
```

Opens the site and the submit function locally (default URL like `http://localhost:8888`). Set the same env vars in a `.env` file or in Netlify’s **Environment variables** (they are used by `netlify dev` when linked).

## Local testing with Express (optional)

```bash
npm start
```

Open `http://localhost:3000`. The form will post to `/api/submit` (your Express server). On any other URL (including Netlify), it posts to `/.netlify/functions/submit`.

## Limits

- Netlify request body size: **6 MB** (free) / **26 MB** (Pro). Keep total photo size under that per submission.
