// Draft storage for the deployed site. Netlify provisions blob storage for
// functions automatically, so there is nothing to configure beyond deploying.

const { getStore } = require("@netlify/blobs");

const STORE_NAME = "injury-drafts";

// Strong consistency matters here: a manager can open the emailed link seconds
// after the employee submits, and the default eventually-consistent read could
// still miss the draft.
function store() {
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

async function save(id, record) {
  await store().setJSON(id, record);
}

async function load(id) {
  return store().get(id, { type: "json" });
}

async function remove(id) {
  await store().delete(id);
}

module.exports = { save, load, remove };
