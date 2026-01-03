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
      
      // Configurar headers CORS
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET');
      
      // Stream directo del archivo
      const readStream = file.createReadStream();
      readStream.pipe(res);
      
      readStream.on('error', (error) => {
        console.error('Stream error:', error);
        res.status(500).send('Error descargando archivo');
      });
    } catch (error) {
      console.error('Proxy error:', error);
      res.status(500).send('Error descargando archivo');
    }
  });
});
