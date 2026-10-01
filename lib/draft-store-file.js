// Draft storage for local development, where Netlify Blobs isn't available.
// Writes to a gitignored folder next to the project.

const fs = require("fs/promises");
const path = require("path");

const DRAFT_DIR = path.join(__dirname, "..", ".drafts");

function draftPath(id) {
  return path.join(DRAFT_DIR, `${id}.json`);
}

async function save(id, record) {
  await fs.mkdir(DRAFT_DIR, { recursive: true });
  await fs.writeFile(draftPath(id), JSON.stringify(record), "utf8");
}

async function load(id) {
  try {
    return JSON.parse(await fs.readFile(draftPath(id), "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

async function remove(id) {
  await fs.rm(draftPath(id), { force: true });
}

module.exports = { save, load, remove };
