// Handles the injury and offensive behavior forms. The utility strike form has
// its own untouched endpoint in submit.js.

const parser = require("lambda-multipart-parser");
const draftStore = require("../../lib/draft-store-azure");
const { submitReport } = require("../../lib/submit-report");
const { jsonResponse, toErrorResponse } = require("../../lib/http");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { success: false, error: "Method not allowed" });
  }

  try {
    const parsed = await parser.parse(event);
    const files = (parsed.files || []).map((file, index) => ({
      filename: file.filename || `photo-${index + 1}.jpg`,
      content: file.content || Buffer.alloc(0),
    }));

    await submitReport({ body: parsed, files, draftStore });

    return jsonResponse(200, { success: true });
  } catch (err) {
    const { status, body } = toErrorResponse(err, "Could not send the report. Please try again.");
    return jsonResponse(status, body);
  }
};
