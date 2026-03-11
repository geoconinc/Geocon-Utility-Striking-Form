# Netlify deploy

- **Publish directory:** `.`
- **Build command:** (empty)
- **Functions directory:** `netlify/functions`

## Environment variables (required)

Set in Site settings → Environment variables:

| Variable      | Example / note                    |
|---------------|-----------------------------------|
| SMTP_HOST     | smtp.office365.com                |
| SMTP_PORT     | 587                               |
| SMTP_SECURE   | false                             |
| SMTP_USER     | sending account email             |
| SMTP_PASS     | app password                      |
| SMTP_FROM     | same as SMTP_USER                 |
| EMAIL_TO      | recipient(s) for form submissions |
| LEGAL_EMAIL   | optional; same email also sent here |

## Local

`npm install` then `netlify dev`. Use a `.env` file (copy from `.env.example`) so the function has SMTP and EMAIL_TO.

## Limits

Request body size: 6 MB (free) / 26 MB (Pro). Keep total photo size per submission under that.
