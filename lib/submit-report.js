// Shared pipeline for the injury and offensive behavior forms, so the Netlify
// function and the local Express server behave identically. Each of them only
// parses the request and picks a draft store. The utility strike form has its
// own separate endpoint and does not come through here.

const { getReport, getFieldNames } = require("./reports");
const { MAX_IMAGE_SIZE_BYTES, sendReportEmail, validateExtraRecipient } = require("./email");
const { saveDraft, readDraft, deleteDraft, mergeDraftData, toPrefillPayload } = require("./drafts");

// Carries the HTTP status the caller should return alongside a message that is
// safe to show the person filling in the form.
class SubmitError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "SubmitError";
    this.status = status;
  }
}

function collectFields(report, body) {
  const data = {};
  for (const name of getFieldNames(report)) {
    data[name] = body[name] != null ? String(body[name]).trim() : "";
  }
  return data;
}

function assertPhotosWithinLimit(photos) {
  const oversized = photos.find((photo) => photo.content.length > MAX_IMAGE_SIZE_BYTES);
  if (!oversized) return;

  const limitMb = Math.round(MAX_IMAGE_SIZE_BYTES / (1024 * 1024));
  throw new SubmitError(
    413,
    `Image "${oversized.filename || "file"}" is too large. Maximum size is ${limitMb} MB per image.`
  );
}

// A storage problem must never stop an injury report reaching HR, because the
// email is the record. A failed read just means the manager retypes the
// incident; a failed write just means their link opens blank.
async function readDraftSafely(store, id) {
  if (!store || !id) return null;

  try {
    return await readDraft(store, id);
  } catch (err) {
    console.error("Could not load saved report:", err);
    return null;
  }
}

async function saveDraftSafely(store, data, attachments) {
  if (!store) return null;

  try {
    return await saveDraft(store, data, attachments);
  } catch (err) {
    console.error("Could not save report for the manager to complete:", err);
    return null;
  }
}

// `files` are normalised to nodemailer's { filename, content } shape by the
// caller, since Netlify and multer expose uploads differently.
async function submitReport({ body, files = [], draftStore = null }) {
  const report = getReport(body.reportType);
  if (!report) throw new SubmitError(400, "Unknown report type.");

  const submitted = collectFields(report, body);

  const recipientError = validateExtraRecipient(report, submitted);
  if (recipientError) throw new SubmitError(400, recipientError);

  const photos = report.acceptsPhotos ? files : [];
  assertPhotosWithinLimit(photos);

  // When a manager follows their emailed link the form posts the draft id back,
  // so the employee's photos are carried into the completed report as well.
  const resumed = report.savesDraft ? await readDraftSafely(draftStore, body.draftId) : null;
  const data = resumed ? mergeDraftData(resumed.data, submitted) : submitted;
  const attachments = resumed ? [...resumed.attachments, ...photos] : photos;

  if (report.savesDraft && report.savesDraft(data)) {
    data.draftId = await saveDraftSafely(draftStore, data, attachments);
  }

  await sendReportEmail(report, data, attachments);

  if (resumed) await deleteDraft(draftStore, resumed.id);
}

// Backs the endpoint the manager's form calls to fill itself in.
async function readDraftForPrefill(store, id) {
  const draft = await readDraft(store, id);
  if (!draft) {
    throw new SubmitError(404, "This link has expired or the report has already been completed.");
  }
  return toPrefillPayload(draft);
}

module.exports = { SubmitError, submitReport, readDraftForPrefill };
