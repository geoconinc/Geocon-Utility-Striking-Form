// Handles the injury and offensive behavior forms. The utility strike form has
// its own untouched endpoint in submit.js.

const parser = require("lambda-multipart-parser");
const { getReport, getFieldNames } = require("../../lib/reports");
const { MAX_IMAGE_SIZE_BYTES, sendReportEmail } = require("../../lib/email");

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function collectFields(report, parsed) {
  const data = {};
  for (const name of getFieldNames(report)) {
    data[name] = parsed[name] != null ? String(parsed[name]).trim() : "";
  }
  return data;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { success: false, error: "Method not allowed" });
  }

  try {
    const parsed = await parser.parse(event);
    const report = getReport(parsed.reportType);
    if (!report) {
      return jsonResponse(400, { success: false, error: "Unknown report type." });
    }

    const files = report.acceptsPhotos ? parsed.files || [] : [];
    const oversized = files.find((file) => (file.content ? file.content.length : 0) > MAX_IMAGE_SIZE_BYTES);
    if (oversized) {
      const limitMb = Math.round(MAX_IMAGE_SIZE_BYTES / (1024 * 1024));
      return jsonResponse(413, {
        success: false,
        error: `Image "${oversized.filename || "file"}" is too large. Maximum size is ${limitMb} MB per image.`,
      });
    }

    const attachments = files.map((file, index) => ({
      filename: file.filename || `photo-${index + 1}.jpg`,
      content: file.content,
    }));

    await sendReportEmail(report, collectFields(report, parsed), attachments);

    return jsonResponse(200, { success: true });
  } catch (err) {
    console.error("Report submit error:", err);
    return jsonResponse(500, { success: false, error: "Could not send the report. Please try again." });
  }
};
