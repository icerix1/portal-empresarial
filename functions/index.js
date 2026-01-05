const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const storage = admin.storage();
const defaultBucket = storage.bucket();

function uniq(arr) {
  return Array.from(new Set(arr.filter(Boolean)));
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

async function translateText(text, source, target) {
  const src = normalizeLang(source);
  const tgt = normalizeLang(target);
  if (!text) return "";
  if (src === tgt) return text;

  if (typeof fetch !== "function") return "";

  const key =
    (functions.config() &&
      functions.config().translate &&
      functions.config().translate.key) ||
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
  if (!context || !context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError(
        "unauthenticated",
        "Authentication required",
    );
  }

  const postId = clampLen(data && data.postId, 128);
  const text = clampLen(data && data.text, 800);
  const author = clampLen(data && data.author, 30);
  const lang = normalizeLang(data && data.lang);
  const isAdmin = !!(data && data.isAdmin);

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

  const uid = context.auth.uid;
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
    uid,
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
