// Shared pipeline for the injury and offensive behavior forms, so the Netlify
// function and the local Express server behave identically. Each of them only
// parses the request and picks a draft store. The utility strike form has its
// own separate endpoint and does not come through here.

const { getReport, getFieldNames } = require("./reports");
const { MAX_IMAGE_SIZE_BYTES, sendReportEmail, validateExtraRecipient } = require("./email");
const { saveDraft, readDraft, readDraftSummary, deleteDraft, mergeDraftData } = require("./drafts");

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

// Storage is a convenience and the email is the record, so no draft operation is
// ever allowed to fail a submission. A failed read means the manager retypes the
// incident; a failed write means their link opens blank; a failed delete after
// the email has gone must not become an error they would retry into a duplicate.
async function attemptDraft(label, operation) {
  try {
    return await withTimeout(operation(), label);
  } catch (err) {
    console.error(`${label} failed:`, err.message);
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
  const resumed =
    report.savesDraft && draftStore && body.draftId
      ? await attemptDraft("Loading the saved report", () => readDraft(draftStore, body.draftId))
      : null;

  const data = resumed ? mergeDraftData(resumed.data, submitted) : submitted;
  const attachments = resumed ? [...resumed.attachments, ...photos] : photos;

  // Still waiting on the manager, so hold it for the link in their email.
  if (report.savesDraft && report.savesDraft(data) && draftStore) {
    data.draftId = await attemptDraft("Saving the report", () =>
      saveDraft(draftStore, data, attachments)
    );
  }

  await sendReportEmail(report, data, attachments);

  if (resumed) {
    await attemptDraft("Deleting the saved report", () => deleteDraft(draftStore, resumed.id));
  }
}

// Backs the endpoint the manager's form calls to fill itself in. Reads only the
// answers and the photo count, never the photo bytes — the form doesn't show
// them, and they are re-attached server side when the report is completed.
async function readDraftForPrefill(store, id) {
  const summary =
    store && id
      ? await attemptDraft("Loading the saved report", () => readDraftSummary(store, id))
      : null;

  if (!summary) {
    // Deliberately hedged: this covers an expired link, an already-completed
    // report, and storage being unreachable, and must not claim the report is
    // done when it might not be.
    throw new SubmitError(404, "This report could not be loaded — the link may have expired or already been used.");
  }

  return { data: summary.data, photoCount: summary.photoCount };
}

module.exports = { SubmitError, submitReport, readDraftForPrefill };
