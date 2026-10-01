// Response shaping shared by the Netlify functions and the local Express server
// for the injury and offensive behavior endpoints.

const { SubmitError } = require("./submit-report");

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

// A SubmitError message is written for the person using the form, so it is safe
// to show. Anything else is unexpected and gets logged behind a generic reply.
function toErrorResponse(err, genericMessage) {
  if (err instanceof SubmitError) {
    return { status: err.status, body: { success: false, error: err.message } };
  }

  console.error("Report request failed:", err);
  return { status: 500, body: { success: false, error: genericMessage } };
}

module.exports = { jsonResponse, toErrorResponse };
