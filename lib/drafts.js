// A manager completing an injury report shouldn't have to retype what the
// employee already filled in. The first submission is saved here under a random
// id, the manager's emailed link carries that id, and their form loads the saved
// answers and photos back. The draft is deleted once the completed report sends.
//
// Storage is passed in as a { save, load, remove } object so the Netlify
// functions can use Netlify Blobs and the local Express server can use disk.

const crypto = require("crypto");

const DRAFT_ID_BYTES = 24;
const DRAFT_ID_PATTERN = new RegExp(`^[a-f0-9]{${DRAFT_ID_BYTES * 2}}$`);

// Drafts hold injury details, so they are not kept indefinitely when a manager
// never gets around to completing the report.
const RETENTION_DAYS = parseInt(process.env.DRAFT_RETENTION_DAYS || "90", 10) || 90;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

// Ids come straight off a URL and are used as storage keys, so reject anything
// that isn't the exact shape createDraftId produces.
function isValidDraftId(id) {
  return typeof id === "string" && DRAFT_ID_PATTERN.test(id);
}

function isExpired(record) {
  return !record.savedAt || Date.now() - record.savedAt > RETENTION_MS;
}

// Photos are base64'd so that a draft is a single JSON record in either store.
function packDraft(data, attachments) {
  return {
    savedAt: Date.now(),
    // Copied so that stamping the new id onto the caller's object can't write
    // the id back into the record it points at.
    data: { ...data },
    photos: attachments.map((attachment) => ({
      filename: attachment.filename,
      content: attachment.content.toString("base64"),
    })),
  };
}

function unpackDraft(record) {
  return {
    data: record.data || {},
    attachments: (record.photos || []).map((photo) => ({
      filename: photo.filename,
      content: Buffer.from(photo.content, "base64"),
    })),
  };
}

async function saveDraft(store, data, attachments) {
  const id = crypto.randomBytes(DRAFT_ID_BYTES).toString("hex");
  await store.save(id, packDraft(data, attachments));
  return id;
}

// Returns null for an unknown, malformed, or expired id rather than throwing,
// since every caller treats "no draft" as a recoverable state.
async function readDraft(store, id) {
  if (!isValidDraftId(id)) return null;

  const record = await store.load(id);
  if (!record) return null;

  if (isExpired(record)) {
    await store.remove(id);
    return null;
  }

  return { id, ...unpackDraft(record) };
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

// What the manager's browser is allowed to see: the saved answers and how many
// photos will be re-attached, never the photo bytes themselves.
function toPrefillPayload(draft) {
  return { data: draft.data, photoCount: draft.attachments.length };
}

module.exports = {
  RETENTION_DAYS,
  isValidDraftId,
  saveDraft,
  readDraft,
  deleteDraft,
  mergeDraftData,
  toPrefillPayload,
};
