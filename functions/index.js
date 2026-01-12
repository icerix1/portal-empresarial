const functions = require("firebase-functions");
const admin = require("firebase-admin");
const archiver = require("archiver");

admin.initializeApp();

const storage = admin.storage();
const defaultBucket = storage.bucket();

function uniq(arr) {
  return Array.from(new Set(arr.filter(Boolean)));
}

function makePathKey(pathArray) {
  const arr = Array.isArray(pathArray) ? pathArray : [];
  if (!arr.length) return "";
  return arr.map((v) => String(v)).join("\u0001");
}

function storagePathFromDownloadUrl(url) {
  if (!url || typeof url !== "string") return "";
  const match = url.match(/\/o\/([^?]+)/);
  if (!match || !match[1]) return "";
  try {
    return decodeURIComponent(match[1]);
  } catch (e) {
    return "";
  }
}

function bucketCandidates(bucketName, fallback) {
  const base = normalizeString(bucketName);
  const list = uniq([
    base,
    base && base.endsWith(".firebasestorage.app") ?
      base.replace(/\.firebasestorage\.app$/, ".appspot.com") :
      "",
    normalizeString(fallback),
  ]);
  return list;
}

async function findExistingFile(storagePath, bucketName) {
  const candidates = bucketCandidates(bucketName, defaultBucket.name);
  for (const b of candidates) {
    if (!b) continue;
    const ref = storage.bucket(b).file(storagePath);
    try {
      const existsArr = await ref.exists();
      const exists = Array.isArray(existsArr) ? existsArr[0] : false;
      if (exists) return ref;
    } catch (e) {
      void e;
    }
  }
  return null;
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function clampLen(value, maxLen) {
  const s = normalizeString(value);
  if (!s) return "";
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen);
}

function normalizeLang(value) {
  const s = clampLen(value, 10).toLowerCase();
  if (s === "es" || s === "en") return s;
  return "en";
}

function unwrapCallablePayload(value) {
  if (!value || typeof value !== "object") return value;
  const inner = value.data;
  if (inner && typeof inner === "object") return inner;
  return value;
}

async function translateText(text, source, target) {
  const src = normalizeLang(source);
  const tgt = normalizeLang(target);
  if (!text) return "";
  if (src === tgt) return text;

  if (typeof fetch !== "function") return "";

  const key =
    process.env.TRANSLATE_API_KEY ||
    process.env.GOOGLE_TRANSLATE_API_KEY ||
    "";

  if (!key) return "";

  try {
    const baseUrl = "https://translation.googleapis.com/language/translate/v2";
    const url = new URL(baseUrl);
    url.searchParams.set("key", key);
    const resp = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: text,
        source: src,
        target: tgt,
        format: "text",
      }),
    });

    if (!resp.ok) return "";
    const json = await resp.json();
    const translatedText =
      json &&
      json.data &&
      Array.isArray(json.data.translations) &&
      json.data.translations[0] &&
      json.data.translations[0].translatedText;
    return typeof translatedText === "string" ? translatedText : "";
  } catch (e) {
    return "";
  }
}

exports.addComment = functions.https.onCall(async (data, context) => {
  const payload = unwrapCallablePayload(data);

  const postIdDirect = clampLen(
      payload &&
      (payload.postId ||
        payload.firebaseId ||
        payload.docId ||
        payload.postDocId),
      128,
  );
  const rawLegacyId =
    payload && (payload.id || payload.postNumericId || payload.postLegacyId);
  let legacyId = null;
  if (typeof rawLegacyId === "number" && Number.isFinite(rawLegacyId)) {
    legacyId = rawLegacyId;
  }
  let postId = postIdDirect;
  if (!postId && legacyId !== null) {
    const snap = await admin.firestore()
        .collection("posts")
        .where("id", "==", legacyId)
        .limit(1)
        .get();
    if (!snap.empty) postId = snap.docs[0].id;
  }
  const text = clampLen(payload && payload.text, 800);
  const author = clampLen(payload && payload.author, 30);
  const lang = normalizeLang(payload && payload.lang);
  const isAdmin = !!(payload && payload.isAdmin);

  if (!postId) {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing postId",
    );
  }
  if (!text) {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing text",
    );
  }

  const uid =
    context && context.auth && context.auth.uid ? String(context.auth.uid) : "";
  const createdAt = Date.now();
  const commentId = `${createdAt}_${uid}_${Math.random()
      .toString(36)
      .slice(2)}`;

  const otherLang = lang === "es" ? "en" : "es";
  const translated = await translateText(text, lang, otherLang);
  const textByLang = {
    [lang]: text,
    [otherLang]: translated || "",
  };

  const comment = {
    id: commentId,
    uid: uid || null,
    author: author || "Anonymous",
    text,
    lang,
    createdAt,
    isAdmin,
    textByLang,
  };

  const postRef = admin.firestore().collection("posts").doc(postId);
  await postRef.update({
    comments: admin.firestore.FieldValue.arrayUnion(comment),
  });

  return {ok: true, comment};
});

exports.addCommentProxy = functions.https.onRequest(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ok: false, error: "Method not allowed"});
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (e) {
      body = null;
    }
  }

  const payload = unwrapCallablePayload(body);

  const postIdDirect = clampLen(
      payload &&
      (payload.postId ||
        payload.firebaseId ||
        payload.docId ||
        payload.postDocId),
      128,
  );
  const rawLegacyId =
    payload && (payload.id || payload.postNumericId || payload.postLegacyId);
  let legacyId = null;
  if (typeof rawLegacyId === "number" && Number.isFinite(rawLegacyId)) {
    legacyId = rawLegacyId;
  }
  let postId = postIdDirect;
  if (!postId && legacyId !== null) {
    const snap = await admin.firestore()
        .collection("posts")
        .where("id", "==", legacyId)
        .limit(1)
        .get();
    if (!snap.empty) postId = snap.docs[0].id;
  }

  const text = clampLen(payload && payload.text, 800);
  const author = clampLen(payload && payload.author, 30);
  const lang = normalizeLang(payload && payload.lang);
  const isAdmin = !!(payload && payload.isAdmin);

  if (!postId) {
    res.status(400).json({ok: false, error: "Missing postId"});
    return;
  }
  if (!text) {
    res.status(400).json({ok: false, error: "Missing text"});
    return;
  }

  const uid = "";
  const createdAt = Date.now();
  const commentId = `${createdAt}_${uid}_${Math.random()
      .toString(36)
      .slice(2)}`;

  const otherLang = lang === "es" ? "en" : "es";
  const translated = await translateText(text, lang, otherLang);
  const textByLang = {
    [lang]: text,
    [otherLang]: translated || "",
  };

  const comment = {
    id: commentId,
    uid: null,
    author: author || "Anonymous",
    text,
    lang,
    createdAt,
    isAdmin,
    textByLang,
  };

  const postRef = admin.firestore().collection("posts").doc(postId);
  await postRef.set(
      {comments: admin.firestore.FieldValue.arrayUnion(comment)},
      {merge: true},
  );

  res.status(200).json({ok: true, comment});
});

exports.zipFolder = functions.https.onRequest(
    {timeoutSeconds: 540, memory: "1GiB"},
    async (req, res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.setHeader(
          "Access-Control-Expose-Headers",
          "Content-Disposition, Content-Length, X-Expected-Bytes",
      );

      if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
      }

      if (req.method !== "GET") {
        res.status(405).json({ok: false, error: "Method not allowed"});
        return;
      }

      try {
        const folderId = normalizeString(req.query && req.query.folderId);
        if (!folderId) {
          res.status(400).json({ok: false, error: "Missing folderId"});
          return;
        }

        const folderSnap = await admin.firestore()
            .collection("files")
            .doc(folderId)
            .get();
        if (!folderSnap.exists) {
          res.status(404).json({ok: false, error: "Folder not found"});
          return;
        }
        const folder = folderSnap.data() || {};
        if (folder.type !== "folder") {
          res.status(400).json({ok: false, error: "Not a folder"});
          return;
        }

        const folderName = clampLen(folder.name || "carpeta", 120) || "carpeta";
        const folderPath = Array.isArray(folder.path) ? folder.path : [];
        const folderFullPath = [...folderPath, folderName];
        const folderKey = makePathKey(folderFullPath);
        if (!folderKey) {
          res.status(400).json({ok: false, error: "Invalid folder path"});
          return;
        }

        const fileDocs = [];

        const queryByPathKey = async () => {
          const directSnap = await admin.firestore()
              .collection("files")
              .where("pathKey", "==", folderKey)
              .get();
          directSnap.forEach((doc) => {
            const data = doc.data() || {};
            if (data.type !== "file") return;
            fileDocs.push({id: doc.id, ...data});
          });

          const startKey = folderKey + "\u0001";
          const endKey = startKey + "\uf8ff";
          let lastDoc = null;
          let done = false;
          while (!done) {
            let q = admin.firestore()
                .collection("files")
                .where("pathKey", ">=", startKey)
                .where("pathKey", "<", endKey)
                .orderBy("pathKey")
                .limit(1000);
            if (lastDoc) q = q.startAfter(lastDoc);
            const snap = await q.get();
            if (snap.empty) {
              done = true;
              break;
            }
            snap.forEach((doc) => {
              const data = doc.data() || {};
              if (data.type !== "file") return;
              fileDocs.push({id: doc.id, ...data});
            });
            lastDoc = snap.docs[snap.docs.length - 1];
          }
        };

        const queryByPathBfs = async () => {
          const pending = [folderFullPath];
          const visited = new Set();
          while (pending.length) {
            const p = pending.shift();
            const key = makePathKey(p);
            if (visited.has(key)) continue;
            visited.add(key);

            const snap = await admin.firestore()
                .collection("files")
                .where("path", "==", p)
                .get();
            snap.forEach((doc) => {
              const data = doc.data() || {};
              if (data.type === "file") fileDocs.push({id: doc.id, ...data});
              if (data.type === "folder" && data.name) {
                pending.push([...p, String(data.name)]);
              }
            });
          }
        };

        await queryByPathKey();
        if (!fileDocs.length) await queryByPathBfs();

        const files = fileDocs
            .filter((f) =>
              f &&
          f.type === "file" &&
          (f.storagePath || f.url) &&
          f.name,
            )
            .map((f) => {
              const pathArray = Array.isArray(f.path) ? f.path : [];
              const relativeParts = pathArray.slice(folderFullPath.length);
              const relativePath = [...relativeParts, String(f.name)]
                  .join("/")
                  .replace(/\\/g, "/");
              const storagePath =
            normalizeString(f.storagePath) || storagePathFromDownloadUrl(f.url);
              const bucketName = normalizeString(f.bucket);
              const rawSize =
            Number.isFinite(f.rawSize) ? f.rawSize : Number(f.rawSize) || 0;
              return {relativePath, storagePath, bucketName, rawSize};
            })
            .filter((f) => f.storagePath && f.relativePath)
            .sort((a, b) => a.relativePath.localeCompare(b.relativePath));

        if (!files.length) {
          res.status(404).json({ok: false, error: "Empty folder"});
          return;
        }

        const zipName = folderName.toLowerCase().endsWith(".zip") ?
      folderName :
      `${folderName}.zip`;

        res.status(200);
        res.setHeader("Content-Type", "application/zip");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${zipName.replace(/"/g, "_")}"`,
        );
        res.setHeader("Cache-Control", "no-store");
        const expectedBytes = files.reduce((acc, f) => {
          const v = Number.isFinite(f.rawSize) ? f.rawSize : 0;
          return acc + (v > 0 ? v : 0);
        }, 0);
        if (expectedBytes > 0) {
          res.setHeader("X-Expected-Bytes", String(expectedBytes));
        }

        const archive = archiver("zip", {store: true});
        archive.on("error", (err) => {
          try {
            res
                .status(500)
                .end(String(err && err.message ? err.message : "zip error"));
          } catch (e) {
            res.end();
          }
        });
        archive.pipe(res);

        for (const f of files) {
          const ref = await findExistingFile(f.storagePath, f.bucketName);
          if (ref) {
            await new Promise((resolve, reject) => {
              const stream = ref.createReadStream();
              stream.once("error", reject);
              stream.once("end", resolve);
              stream.once("close", resolve);
              archive.append(stream, {name: f.relativePath});
            });
          } else {
            archive.append(Buffer.from(""), {name: f.relativePath});
          }
        }

        await archive.finalize();
      } catch (error) {
        res.status(500).json({
          ok: false,
          error: String(error && error.message ? error.message : error),
        });
      }
    },
);

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
