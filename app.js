const express = require('express');
const multer = require('multer');
const { S3Client, PutObjectCommand, ListObjectsCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
require('dotenv').config();

const app = express();
const port = 3000;

// Configuração do multer para upload de arquivos
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Configuração do cliente S3 (R2)
const s3 = new S3Client({
  endpoint: process.env.R2_ENDPOINT_URL,
  region: 'auto',
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY,
    secretAccessKey: process.env.R2_SECRET_KEY,
  },
});

app.use(express.static('public'));

// Rota para upload de vídeos
app.post('/upload', upload.single('video'), async (req, res) => {
  const video = req.file;
  const uploadParams = {
    Bucket: process.env.R2_BUCKET_NAME,
    Key: video.originalname,
    Body: video.buffer,
    ContentType: video.mimetype,
  };

  try {
    await s3.send(new PutObjectCommand(uploadParams));
    res.status(200).send('Upload successful');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error uploading file');
  }
});

// Rota para listar vídeos
app.get('/videos', async (req, res) => {
  const listParams = {
    Bucket: process.env.R2_BUCKET_NAME,
  };

  try {
    const data = await s3.send(new ListObjectsCommand(listParams));
    res.json(data.Contents);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching videos');
  }
});

// Rota para obter URL assinado para reprodução de vídeo
app.get('/video-url/:key', async (req, res) => {
  const { key } = req.params;
  const params = {
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
  };

  try {
    const url = await getSignedUrl(s3, new GetObjectCommand(params), { expiresIn: 3600 }); // URL válido por 1 hora
    res.json({ url });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error generating signed URL');
  }
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
