const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const storage = admin.storage();
const defaultBucket = storage.bucket();

function uniq(arr) {
  return Array.from(new Set(arr.filter(Boolean)));
}

exports.downloadProxy = functions.https.onRequest(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  try {
    const rawBucket = req.query && req.query.bucket;
    const raw = req.query && req.query.filePath;
    const filePath = typeof raw === "string" ? decodeURIComponent(raw) : "";
    if (!filePath) {
      res.status(400).send("Missing filePath");
      return;
    }

    const bucketName =
      typeof rawBucket === "string" ? decodeURIComponent(rawBucket) : "";

    const projectId =
      process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "";
    const candidates = uniq([
      bucketName,
      bucketName && bucketName.endsWith(".firebasestorage.app") ?
        bucketName.replace(/\.firebasestorage\.app$/, ".appspot.com") :
        "",
      projectId ? `${projectId}.appspot.com` : "",
      projectId ? `${projectId}.firebasestorage.app` : "",
    ]);

    let file = null;
    if (candidates.length) {
      for (const name of candidates) {
        const b = storage.bucket(name);
        const f = b.file(filePath);
        const [exists] = await f.exists();
        if (exists) {
          file = f;
          break;
        }
      }
    }

    if (!file) {
      const f = defaultBucket.file(filePath);
      const [exists] = await f.exists();
      if (!exists) {
        res.status(404).send("Not found");
        return;
      }
      file = f;
    }

    const readStream = file.createReadStream();

    readStream.on("error", (error) => {
      console.error("Stream error:", error);
      if (!res.headersSent) res.status(404);
      res.end();
    });

    readStream.pipe(res);
  } catch (error) {
    console.error("Proxy error:", error);
    res.status(500).send("Error descargando archivo");
  }
});
