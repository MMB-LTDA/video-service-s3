const ffmpeg = require('fluent-ffmpeg');
const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// Configurações do Cloudflare R2 (compatível com AWS S3)
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_KEY;
const R2_ENDPOINT_URL = process.env.R2_ENDPOINT_URL; // Ex.: ABC1234567890

const s3 = new AWS.S3({
  endpoint: R2_ENDPOINT_URL,
  accessKeyId: R2_ACCESS_KEY_ID,
  secretAccessKey: R2_SECRET_ACCESS_KEY,
  signatureVersion: 'v4',
});

// Função para converter MP4 para HLS
function convertMP4ToHLS(inputFile, outputDir, callback) {
  ffmpeg(inputFile)
    .output(`${outputDir}/output.m3u8`)
    .addOptions([
      '-codec: copy',
      '-start_number 0',
      '-hls_time 10',
      '-hls_list_size 0',
      '-f hls',
    ])
    .on('end', () => {
      console.log('Conversão concluída!');
      callback(null);
    })
    .on('error', (err) => {
      console.error('Erro na conversão:', err.message);
      callback(err);
    })
    .run();
}

// Função para fazer upload de arquivos para o Cloudflare R2
function uploadToR2(directoryPath, r2Directory, callback) {
  fs.readdir(directoryPath, (err, files) => {
    if (err) return callback(err);

    const uploadPromises = files.map((file) => {
      const filePath = path.join(directoryPath, file);
      const fileStream = fs.createReadStream(filePath);

      const params = {
        Bucket: R2_BUCKET_NAME,
        Key: `${r2Directory}/${file}`,
        Body: fileStream,
      };

      return s3.upload(params).promise();
    });

    Promise.all(uploadPromises)
      .then(() => {
        console.log('Upload concluído com sucesso!');
        callback(null);
      })
      .catch((err) => {
        console.error('Erro no upload:', err.message);
        callback(err);
      });
  });
}

// Função principal para conversão e upload
function main(inputFilePath) {
  const outputDir = `./output-${uuidv4()}`; // Pasta temporária com UUID para armazenar arquivos HLS
  const r2Directory = uuidv4(); // UUID para a pasta de destino no R2

  // Cria o diretório de saída
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  // Converte o MP4 para HLS
  convertMP4ToHLS(inputFilePath, outputDir, (err) => {
    if (err) return console.error('Falha na conversão do vídeo:', err);

    // Faz o upload dos arquivos convertidos para o Cloudflare R2
    uploadToR2(outputDir, r2Directory, (uploadErr) => {
      if (uploadErr) return console.error('Falha no upload para R2:', uploadErr);

      console.log('Processo concluído: conversão e upload feitos com sucesso!');
    });
  });
}

// Exemplo de uso
main('caminho/para/seu/video.mp4');
