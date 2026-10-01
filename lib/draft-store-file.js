// Draft storage for local development, where Azure isn't configured. Mirrors the
// Azure layout — a JSON record per draft, with photos in a folder beside it —
// so both stores behave the same way. Writes to a gitignored folder.

const fs = require("fs/promises");
const path = require("path");

const DRAFT_DIR = path.join(__dirname, "..", ".drafts");

// Ids are validated as hex upstream, so they are safe to use as path segments.
function recordPath(id) {
  return path.join(DRAFT_DIR, `${id}.json`);
}

function photoDir(id) {
  return path.join(DRAFT_DIR, id);
}

function photoPath(id, index) {
  return path.join(photoDir(id), String(index));
}

async function save(id, record, attachments) {
  await fs.mkdir(DRAFT_DIR, { recursive: true });
  await fs.writeFile(recordPath(id), JSON.stringify(record), "utf8");

  if (attachments.length === 0) return;

  await fs.mkdir(photoDir(id), { recursive: true });
  await Promise.all(
    attachments.map((attachment, index) => fs.writeFile(photoPath(id, index), attachment.content))
  );
}

async function loadRecord(id) {
  try {
    return JSON.parse(await fs.readFile(recordPath(id), "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

async function loadAttachments(id, photos) {
  return Promise.all(
    photos.map(async (photo, index) => ({
      filename: photo.filename,
      content: await fs.readFile(photoPath(id, index)),
    }))
  );
}

async function remove(id) {
  await fs.rm(recordPath(id), { force: true });
  await fs.rm(photoDir(id), { recursive: true, force: true });
}

module.exports = { save, loadRecord, loadAttachments, remove };
