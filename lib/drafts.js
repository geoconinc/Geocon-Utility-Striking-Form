// A manager completing an injury report shouldn't have to retype what the
// employee already filled in. The first submission is saved here under a random
// id, the manager's emailed link carries that id, and their form loads the saved
// answers back. The draft is deleted once the completed report reaches HR.
//
// Each draft is stored as a small JSON record plus one binary blob per photo:
//
//   <id>.json   the answers, and the filename of each photo
//   <id>/0      the first photo, as uploaded
//   <id>/1      ...
//
// Keeping photos out of the record is what makes prefilling cheap. The manager's
// form only needs the text, so it reads a couple of kilobytes instead of pulling
// several megabytes of images it would immediately discard. The photos are
// fetched once, when the completed report is built.
//
// Storage is passed in as a { save, loadRecord, loadAttachments, remove } object
// so the Netlify functions can use Azure and the local server can use disk.

const crypto = require("crypto");

const DRAFT_ID_BYTES = 24;
const DRAFT_ID_PATTERN = new RegExp(`^[a-f0-9]{${DRAFT_ID_BYTES * 2}}$`);

// Drafts hold injury details, so they are not kept indefinitely when a manager
// never gets around to completing the report.
const RETENTION_DAYS = parseInt(process.env.DRAFT_RETENTION_DAYS || "90", 10) || 90;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

// Ids come straight off a URL and are used as storage keys, so reject anything
// that isn't the exact shape saveDraft produces.
function isValidDraftId(id) {
  return typeof id === "string" && DRAFT_ID_PATTERN.test(id);
}

function isExpired(record) {
  return !record.savedAt || Date.now() - record.savedAt > RETENTION_MS;
}

async function saveDraft(store, data, attachments) {
  const id = crypto.randomBytes(DRAFT_ID_BYTES).toString("hex");

  const record = {
    savedAt: Date.now(),
    // Copied so that stamping the new id onto the caller's object can't write
    // the id back into the record it points at.
    data: { ...data },
    photos: attachments.map((attachment) => ({ filename: attachment.filename })),
  };

  await store.save(id, record, attachments);
  return id;
}

// Returns null for an unknown, malformed, or expired id rather than throwing,
// since every caller treats "no draft" as a recoverable state.
async function readRecord(store, id) {
  if (!isValidDraftId(id)) return null;

  const record = await store.loadRecord(id);
  if (!record) return null;

  if (isExpired(record)) {
    await store.remove(id);
    return null;
  }

  return record;
}

// Enough to fill the manager's form in, without moving any photo bytes.
async function readDraftSummary(store, id) {
  const record = await readRecord(store, id);
  if (!record) return null;

  return { id, data: record.data || {}, photoCount: (record.photos || []).length };
}

// The whole draft, photos included, for building the report HR receives.
async function readDraft(store, id) {
  const record = await readRecord(store, id);
  if (!record) return null;

  const photos = record.photos || [];

  return {
    id,
    data: record.data || {},
    attachments: photos.length > 0 ? await store.loadAttachments(id, photos) : [],
  };
}

async function deleteDraft(store, id) {
  if (isValidDraftId(id)) await store.remove(id);
}

// The manager's form opens prefilled, so whatever they submit wins. Falling back
// to the saved value keeps an employee's answer in cases where the manager's
// form didn't carry the field.
function mergeDraftData(draftData, submitted) {
  const merged = { ...draftData };
  for (const [name, value] of Object.entries(submitted)) {
    if (value) merged[name] = value;
  }
  return merged;
}

module.exports = {
  RETENTION_DAYS,
  isValidDraftId,
  saveDraft,
  readDraft,
  readDraftSummary,
  deleteDraft,
  mergeDraftData,
};
