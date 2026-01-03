const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const storage = admin.storage();
const bucket = storage.bucket("compresor-de-archivos-15e3a.appspot.com");
const cors = require("cors")({ origin: true });

exports.downloadProxy = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const filePath = decodeURIComponent(req.query.filePath);
      const file = bucket.file(filePath);
      
      const [downloadURL] = await file.getSignedUrl({
        action: "read",
        expires: Date.now() + 15 * 60 * 1000, // 15 min
      });
      
      res.redirect(downloadURL);
    } catch (error) {
      console.error("Proxy error:", error);
      res.status(500).send("Error descargando archivo");
    }
  });
});
