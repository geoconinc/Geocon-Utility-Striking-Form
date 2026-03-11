require("dotenv").config();

const express = require("express");
const multer = require("multer");
const path = require("path");
const nodemailer = require("nodemailer");

const app = express();
const PORT = process.env.PORT || 3000;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed."));
  },
});

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

function buildEmailHtml(data, attachmentCount = 0) {
  const field = (label, value) =>
    value ? `<tr><td style="padding:6px 12px;font-weight:600;vertical-align:top;white-space:nowrap;">${label}</td><td style="padding:6px 12px;">${value}</td></tr>` : "";

  const photoSection = attachmentCount > 0
    ? `<h3 style="margin-top:24px;">Photos</h3>
       <p style="margin-bottom:8px;color:#555;">Photo(s) are attached to this email — you can save or download them from the attachments.</p>`
    : "";

  return `
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:680px;margin:0 auto;">
      <div style="background:#0B5E5B;color:#fff;padding:18px 24px;border-radius:8px 8px 0 0;">
        <h2 style="margin:0;">Utility Strike Report</h2>
      </div>
      <div style="padding:16px 24px;background:#fff;border:1px solid #ddd;border-top:none;border-radius:0 0 8px 8px;">
        <table style="width:100%;border-collapse:collapse;">
          ${field("Project #", data.projectNumber)}
          ${field("Project Name", data.projectName)}
          ${field("Reporter", data.reporterName)}
          ${field("Project Manager", data.projectManager)}
          ${field("Employee(s) On-Site", data.employeesOnSite)}
          ${field("Date of Strike", data.strikeDate)}
          ${field("Time of Strike", data.strikeTime)}
          ${field("Client Contact", data.clientContact)}
          ${field("Client Phone", data.clientPhone)}
          ${field("Dig Alert Ticket #", data.digAlertTicket)}
          ${field("Dig Alert Explanation", data.digAlertExplanation)}
          ${field("Private Locator Hired?", data.privateLocator)}
          ${field("Locator Subcontractor", data.locatorSubcontractor)}
          ${field("Why No Locator?", data.locatorWhyNot)}
          ${field("Drilling Subcontractor", data.drillingSubcontractor)}
          ${field("Utility Type(s)", data.utilityType)}
          ${field("Description", data.description)}
        </table>
        ${photoSection}
      </div>
    </div>`;
}

function getEmailRecipients() {
  const to = [];
  if (process.env.EMAIL_TO && process.env.EMAIL_TO.trim()) to.push(process.env.EMAIL_TO.trim());
  const legal = process.env.LEGAL_EMAIL || process.env.EMAIL_TO_LEGAL;
  if (legal && legal.trim()) to.push(legal.trim());
  return [...new Set(to)].join(", ");
}

async function sendEmail(data, files = []) {
  const recipients = getEmailRecipients();
  if (!recipients) throw new Error("No email recipients configured. Set EMAIL_TO (and optionally LEGAL_EMAIL) in .env");
  const transporter = createTransporter();
  const subject = `Utility Strike Report – ${data.projectName || "No Project Name"} (${data.strikeDate || "No Date"})`;

  const attachments = files.map((file, i) => ({
    filename: file.originalname || `photo-${i + 1}.jpg`,
    content: file.buffer,
  }));

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: recipients,
    subject,
    html: buildEmailHtml(data, files.length),
    attachments: attachments.length > 0 ? attachments : undefined,
  });
}

app.use(express.static(path.join(__dirname)));

app.post("/api/submit", upload.array("photos", 20), async (req, res) => {
  try {
    const data = req.body;
    const files = req.files || [];

    await sendEmail(data, files);

    res.json({ success: true });
  } catch (err) {
    console.error("Submission error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
