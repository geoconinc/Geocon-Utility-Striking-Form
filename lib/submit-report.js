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

// Netlify allows a synchronous function about ten seconds in total, so storage
// is never allowed to eat the budget the email itself needs. This caps every
// draft operation regardless of how the underlying client retries.
const DRAFT_TIMEOUT_MS = parseInt(process.env.DRAFT_TIMEOUT_MS || "3000", 10) || 3000;

function withTimeout(promise, label) {
  let timer;
  const deadline = new Promise((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${DRAFT_TIMEOUT_MS}ms`)), DRAFT_TIMEOUT_MS);
  });

  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}

// A storage problem must never stop an injury report reaching HR, because the
// email is the record. A failed read just means the manager retypes the
// incident; a failed write just means their link opens blank.
async function readDraftSafely(store, id) {
  if (!store || !id) return null;

  try {
    return await withTimeout(readDraft(store, id), "Loading the saved report");
  } catch (err) {
    console.error("Could not load saved report:", err.message);
    return null;
  }
}

async function saveDraftSafely(store, data, attachments) {
  if (!store) return null;

  try {
    return await withTimeout(saveDraft(store, data, attachments), "Saving the report");
  } catch (err) {
    console.error("Could not save report for the manager to complete:", err.message);
    return null;
  }
}

// Runs after the email has already gone out, so a failure here must not turn a
// delivered report into an error the user would retry and duplicate.
async function deleteDraftSafely(store, id) {
  try {
    await withTimeout(deleteDraft(store, id), "Deleting the saved report");
  } catch (err) {
    console.error("Could not delete the saved report after completion:", err.message);
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

  if (resumed) await deleteDraftSafely(draftStore, resumed.id);
}

// Backs the endpoint the manager's form calls to fill itself in.
async function readDraftForPrefill(store, id) {
  const draft = await readDraftSafely(store, id);
  if (!draft) {
    // Deliberately hedged: this covers an expired link, an already-completed
    // report, and storage being unreachable, and must not claim the report is
    // done when it might not be.
    throw new SubmitError(404, "This report could not be loaded — the link may have expired or already been used.");
  }
  return toPrefillPayload(draft);
}

module.exports = { SubmitError, submitReport, readDraftForPrefill };
