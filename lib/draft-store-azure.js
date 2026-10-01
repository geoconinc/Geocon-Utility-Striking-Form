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
    // No access option, so the container is private.
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
function recordName(id) {
  return `${id}.json`;
}

function photoName(id, index) {
  return `${id}/${index}`;
}

async function save(id, record, attachments) {
  const client = await container();
  const body = JSON.stringify(record);

  // One round trip for everything rather than one after another.
  await Promise.all([
    client.getBlockBlobClient(recordName(id)).upload(body, Buffer.byteLength(body), {
      blobHTTPHeaders: { blobContentType: "application/json" },
    }),
    ...attachments.map((attachment, index) =>
      client.getBlockBlobClient(photoName(id, index)).upload(attachment.content, attachment.content.length)
    ),
  ]);
}

async function loadRecord(id) {
  const blob = (await container()).getBlockBlobClient(recordName(id));

  try {
    return JSON.parse((await blob.downloadToBuffer()).toString("utf8"));
  } catch (err) {
    if (err.statusCode === 404) return null;
    throw err;
  }
}

// `photos` carries the filenames from the record; the bytes sit at a predictable
// name per index, so no listing is needed to fetch them.
async function loadAttachments(id, photos) {
  const client = await container();

  return Promise.all(
    photos.map(async (photo, index) => ({
      filename: photo.filename,
      content: await client.getBlockBlobClient(photoName(id, index)).downloadToBuffer(),
    }))
  );
}

async function remove(id) {
  const client = await container();
  const names = [recordName(id)];

  for await (const blob of client.listBlobsFlat({ prefix: `${id}/` })) names.push(blob.name);

  await Promise.all(names.map((name) => client.getBlockBlobClient(name).deleteIfExists()));
}

module.exports = { save, loadRecord, loadAttachments, remove };
