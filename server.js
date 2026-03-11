require("dotenv").config();

const express = require("express");
const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { BlobServiceClient } = require("@azure/storage-blob");
const { TableClient } = require("@azure/data-tables");
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

// ---- Azure Blob Storage ----

function getBlobContainerClient() {
  const blobService = BlobServiceClient.fromConnectionString(
    process.env.AZURE_STORAGE_CONNECTION_STRING
  );
  return blobService.getContainerClient(
    process.env.AZURE_BLOB_CONTAINER || "utility-strike-photos"
  );
}

async function ensureBlobContainer() {
  const container = getBlobContainerClient();
  await container.createIfNotExists({ access: "blob" });
  return container;
}

async function uploadPhoto(container, file, reportId) {
  const ext = path.extname(file.originalname) || ".jpg";
  const blobName = `${reportId}/${uuidv4()}${ext}`;
  const blockBlob = container.getBlockBlobClient(blobName);

  await blockBlob.uploadData(file.buffer, {
    blobHTTPHeaders: { blobContentType: file.mimetype },
  });

  return blockBlob.url;
}

// ---- Azure Table Storage ----

function getTableClient() {
  return TableClient.fromConnectionString(
    process.env.AZURE_STORAGE_CONNECTION_STRING,
    process.env.AZURE_TABLE_NAME || "UtilityStrikeReports"
  );
}

async function ensureTable() {
  const table = getTableClient();
  await table.createTable().catch((err) => {
    if (err.statusCode !== 409) throw err;
  });
  return table;
}

async function saveReport(table, reportId, data, photoUrls) {
  const datePrefix = new Date().toISOString().slice(0, 10);

  const entity = {
    partitionKey: datePrefix,
    rowKey: reportId,
    projectNumber: data.projectNumber || "",
    projectName: data.projectName || "",
    reporterName: data.reporterName || "",
    projectManager: data.projectManager || "",
    employeesOnSite: data.employeesOnSite || "",
    strikeDate: data.strikeDate || "",
    strikeTime: data.strikeTime || "",
    clientContact: data.clientContact || "",
    clientPhone: data.clientPhone || "",
    digAlertTicket: data.digAlertTicket || "",
    digAlertExplanation: data.digAlertExplanation || "",
    privateLocator: data.privateLocator || "",
    locatorSubcontractor: data.locatorSubcontractor || "",
    locatorWhyNot: data.locatorWhyNot || "",
    drillingSubcontractor: data.drillingSubcontractor || "",
    utilityType: data.utilityType || "",
    description: data.description || "",
    photoUrls: JSON.stringify(photoUrls),
    submittedAt: new Date().toISOString(),
  };

  await table.createEntity(entity);
  return entity;
}

// ---- Email ----

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

function buildEmailHtml(data, photoUrls, attachmentCount = 0) {
  const field = (label, value) =>
    value ? `<tr><td style="padding:6px 12px;font-weight:600;vertical-align:top;white-space:nowrap;">${label}</td><td style="padding:6px 12px;">${value}</td></tr>` : "";

  const hasAttachments = attachmentCount > 0;
  const hasPreviewUrls = photoUrls.length > 0;
  let photoSection = "";
  if (hasAttachments || hasPreviewUrls) {
    photoSection = `<h3 style="margin-top:24px;">Photos</h3>
       <p style="margin-bottom:8px;color:#555;">${hasAttachments ? "Photo(s) are attached to this email — you can save or download them from the attachments." : ""}${hasAttachments && hasPreviewUrls ? " " : ""}${hasPreviewUrls ? "Preview links below:" : ""}</p>`;
    if (hasPreviewUrls) {
      photoSection += `<div>${photoUrls.map((url, i) => `<a href="${url}" target="_blank" style="margin-right:8px;"><img src="${url}" alt="Photo ${i + 1}" style="width:180px;height:auto;border-radius:4px;margin:4px;border:1px solid #ccc;"></a>`).join("")}</div>`;
    }
  }

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
  const to = [process.env.EMAIL_TO || "mundra@Geoconinc.com"];
  const legal = process.env.LEGAL_EMAIL || process.env.EMAIL_TO_LEGAL;
  if (legal && legal.trim()) to.push(legal.trim());
  return [...new Set(to)].join(", ");
}

async function sendEmail(data, photoUrls, files = []) {
  const transporter = createTransporter();
  const recipients = getEmailRecipients();
  const subject = `Utility Strike Report – ${data.projectName || "No Project Name"} (${data.strikeDate || "No Date"})`;

  const attachments = files.map((file, i) => ({
    filename: file.originalname || `photo-${i + 1}.jpg`,
    content: file.buffer,
  }));

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: recipients,
    subject,
    html: buildEmailHtml(data, photoUrls, files.length),
    attachments: attachments.length > 0 ? attachments : undefined,
  });
}

// ---- Serve static frontend ----

app.use(express.static(path.join(__dirname)));

// ---- API endpoint ----

const useAzure = Boolean(process.env.AZURE_STORAGE_CONNECTION_STRING);

app.post("/api/submit", upload.array("photos", 20), async (req, res) => {
  try {
    const reportId = uuidv4();
    const data = req.body;
    const files = req.files || [];
    let photoUrls = [];

    if (useAzure) {
      const container = await ensureBlobContainer();
      for (const file of files) {
        const url = await uploadPhoto(container, file, reportId);
        photoUrls.push(url);
      }
      const table = await ensureTable();
      await saveReport(table, reportId, data, photoUrls);
    }

    // Email always sent: form data in body + photos as attachments (legal can save them)
    await sendEmail(data, photoUrls, files);

    res.json({ success: true, reportId });
  } catch (err) {
    console.error("Submission error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---- Start ----

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
