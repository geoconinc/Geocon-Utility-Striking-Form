// Draft storage in Geocon's own Azure storage account, so the injury details
// held between the employee's submission and the manager's investigation stay
// inside the company tenant.
//
// AZURE_STORAGE_CONNECTION_STRING comes from the storage account's
// "Access keys" page. AZURE_STORAGE_CONTAINER overrides the container name.

const { BlobServiceClient } = require("@azure/storage-blob");

const DEFAULT_CONTAINER = "injury-drafts";

// The SDK defaults to four attempts with exponential backoff, which takes over
// thirty seconds to give up — far longer than a Netlify function is allowed to
// run. Saving a draft is a convenience; sending the email is not, so storage
// gets a small slice of the budget and then gets out of the way.
const PIPELINE_OPTIONS = {
  retryOptions: { maxTries: 2, tryTimeoutInMs: 3000, retryDelayInMs: 300, maxRetryDelayInMs: 1000 },
};

let containerPromise = null;

async function openContainer() {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error("AZURE_STORAGE_CONNECTION_STRING is not set.");
  }

  const name = process.env.AZURE_STORAGE_CONTAINER || DEFAULT_CONTAINER;
  const client = BlobServiceClient.fromConnectionString(
    connectionString,
    PIPELINE_OPTIONS
  ).getContainerClient(name);

  try {
    await client.createIfNotExists();
  } catch (err) {
    // Credentials scoped to a single container cannot create one. That is fine
    // as long as it already exists, and the next read or write will say if it
    // doesn't.
    console.warn(`Could not ensure the "${name}" container exists:`, err.message);
  }

  return client;
}

// Held across invocations on a warm function instance, so the container check
// costs one round trip per cold start rather than one per report. A failure
// clears the cache so the next request retries instead of inheriting the error.
function container() {
  if (!containerPromise) {
    containerPromise = openContainer().catch((err) => {
      containerPromise = null;
      throw err;
    });
  }
  return containerPromise;
}

// Ids are validated as hex upstream, so they are safe to use as blob names.
function blobName(id) {
  return `${id}.json`;
}

async function save(id, record) {
  const body = JSON.stringify(record);
  const blob = (await container()).getBlockBlobClient(blobName(id));

  await blob.upload(body, Buffer.byteLength(body), {
    blobHTTPHeaders: { blobContentType: "application/json" },
  });
}

async function load(id) {
  const blob = (await container()).getBlockBlobClient(blobName(id));

  try {
    return JSON.parse((await blob.downloadToBuffer()).toString("utf8"));
  } catch (err) {
    if (err.statusCode === 404) return null;
    throw err;
  }
}

async function remove(id) {
  await (await container()).getBlockBlobClient(blobName(id)).deleteIfExists();
}

module.exports = { save, load, remove };
