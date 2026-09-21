const nodemailer = require("nodemailer");

const MAX_IMAGE_SIZE_BYTES = (parseInt(process.env.MAX_IMAGE_SIZE_MB || "20", 10) || 20) * 1024 * 1024;

const HTML_ESCAPES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

// Submitted values are attacker-controlled free text; escape before templating
// them into the email body.
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

function renderRow(label, value) {
  return (
    `<tr><td style="padding:6px 12px;font-weight:600;vertical-align:top;white-space:nowrap;">${escapeHtml(label)}</td>` +
    `<td style="padding:6px 12px;white-space:pre-wrap;">${escapeHtml(value)}</td></tr>`
  );
}

function renderSectionHeading(title) {
  return (
    `<tr><td colspan="2" style="padding:18px 12px 6px;font-weight:700;color:#0B5E5B;` +
    `border-bottom:1px solid #ddd;">${escapeHtml(title)}</td></tr>`
  );
}

const STATUS_TONES = {
  pending: { background: "#FFF4E5", border: "#E0A458", text: "#7A4E00" },
  done: { background: "#E8F5EE", border: "#1E8C5A", text: "#14603D" },
};

function renderStatusBanner(report, data) {
  if (!report.statusLine) return "";

  const status = report.statusLine(data);
  const tone = STATUS_TONES[status.tone] || STATUS_TONES.pending;

  return (
    `<div style="margin-bottom:16px;padding:12px 16px;border-radius:6px;font-weight:600;` +
    `background:${tone.background};border:1px solid ${tone.border};color:${tone.text};">` +
    `${escapeHtml(status.text)}</div>`
  );
}

function buildEmailHtml(report, data, attachmentCount = 0) {
  const rows = report.sections
    .map((section) => {
      const filled = section.fields.filter((field) => data[field.name]);
      if (filled.length === 0) return "";
      const heading = section.title ? renderSectionHeading(section.title) : "";
      return heading + filled.map((field) => renderRow(field.label, data[field.name])).join("");
    })
    .join("");

  const photoSection =
    attachmentCount > 0
      ? `<h3 style="margin-top:24px;">Photos</h3>
       <p style="margin-bottom:8px;color:#555;">Photo(s) are attached to this email — you can save or download them from the attachments.</p>`
      : "";

  return `
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:680px;margin:0 auto;">
      <div style="background:#0B5E5B;color:#fff;padding:18px 24px;border-radius:8px 8px 0 0;">
        <h2 style="margin:0;">${escapeHtml(report.title)}</h2>
      </div>
      <div style="padding:16px 24px;background:#fff;border:1px solid #ddd;border-top:none;border-radius:0 0 8px 8px;">
        ${renderStatusBanner(report, data)}
        <table style="width:100%;border-collapse:collapse;">
          ${rows}
        </table>
        ${photoSection}
      </div>
    </div>`;
}

// A user-supplied recipient is only honoured on the company domain, so the form
// cannot be used to send mail to arbitrary addresses.
function isAllowedExtraRecipient(report, address) {
  if (!report.extraRecipientDomain) return false;
  const pattern = new RegExp(`^[^@\\s]+@${report.extraRecipientDomain.replace(/\./g, "\\.")}$`, "i");
  return pattern.test(address);
}

function getRecipients(report, data = {}) {
  const addresses = report.recipientEnvKeys
    .flatMap((key) => (process.env[key] || "").split(","))
    .map((address) => address.trim())
    .filter(Boolean);

  const resolved = addresses.length > 0 ? addresses : report.defaultRecipients || [];

  const extra = (data[report.extraRecipientField] || "").trim();
  if (extra && isAllowedExtraRecipient(report, extra)) resolved.push(extra);

  return [...new Set(resolved)].join(", ");
}

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

// `attachments` are already normalised to nodemailer's { filename, content } shape.
async function sendReportEmail(report, data, attachments = []) {
  const recipients = getRecipients(report, data);
  if (!recipients) {
    throw new Error("No email recipients configured for this report type.");
  }

  await createTransporter().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: recipients,
    subject: report.subject(data),
    html: buildEmailHtml(report, data, attachments.length),
    attachments: attachments.length > 0 ? attachments : undefined,
  });
}

// Returns an error message when the submitted recipient is unusable, or null.
function validateExtraRecipient(report, data) {
  if (!report.extraRecipientField) return null;

  const address = (data[report.extraRecipientField] || "").trim();
  if (address && !isAllowedExtraRecipient(report, address)) {
    return `Please enter a valid @${report.extraRecipientDomain} email address.`;
  }
  return null;
}

module.exports = {
  MAX_IMAGE_SIZE_BYTES,
  buildEmailHtml,
  getRecipients,
  sendReportEmail,
  validateExtraRecipient,
};
