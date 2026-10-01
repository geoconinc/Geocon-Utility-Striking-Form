// Serves a saved injury report back to the manager's form so they don't have to
// retype what the employee already filled in. Photo bytes are never returned,
// only a count — they are re-attached server side when the report is completed.

const draftStore = require("../../lib/draft-store-azure");
const { readDraftForPrefill } = require("../../lib/submit-report");
const { jsonResponse, toErrorResponse } = require("../../lib/http");

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return jsonResponse(405, { success: false, error: "Method not allowed" });
  }

  try {
    const { id } = event.queryStringParameters || {};
    const payload = await readDraftForPrefill(draftStore, id);

    return jsonResponse(200, { success: true, ...payload });
  } catch (err) {
    const { status, body } = toErrorResponse(err, "Could not load the saved report.");
    return jsonResponse(status, body);
  }
};
