const { 
  S3Client, 
  PutObjectCommand, 
  DeleteObjectCommand, 
  GetObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  PutBucketCorsCommand
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const getS3Config = () => {
  const region = process.env.AWS_REGION || 'ap-south-1';
  const bucketName = process.env.AWS_BUCKET_NAME || 'life-awakening-media-2026';

  const s3ClientConfig = { region };

  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    s3ClientConfig.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    };
  }

  const s3Client = new S3Client(s3ClientConfig);

  return { s3Client, region, bucketName };
};

module.exports = {
  configureBucketCors: async () => {
    try {
      const { s3Client, bucketName } = getS3Config();
      const command = new PutBucketCorsCommand({
        Bucket: bucketName,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedHeaders: ['*'],
              AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
              AllowedOrigins: ['*'],
              ExposeHeaders: ['ETag', 'x-amz-server-side-encryption', 'x-amz-request-id', 'x-amz-id-2'],
              MaxAgeSeconds: 3600
            }
          ]
        }
      });
      await s3Client.send(command);
      console.log('[S3] Bucket CORS policy applied successfully.');
      return true;
    } catch (err) {
      console.warn('[S3] Bucket CORS auto-config warning:', err.message);
      return false;
    }
  },

  getPresignedUploadUrl: async (fileName, mimeType, expiresIn = 3600) => {
    const { s3Client, bucketName } = getS3Config();

    const sanitizedName = (fileName || 'media').replace(/[^a-zA-Z0-9.-]/g, '_');
    const storageKey = `journey/${Date.now()}_${Math.random().toString(36).substring(2, 8)}_${sanitizedName}`;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: storageKey,
      ContentType: mimeType
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn });

    return {
      storageKey,
      uploadUrl,
      fileUrl: `/api/media/file?key=${encodeURIComponent(storageKey)}`
    };
  },

  initiateMultipartUpload: async (fileName, mimeType) => {
    const { s3Client, bucketName } = getS3Config();

    const sanitizedName = (fileName || 'video.mp4').replace(/[^a-zA-Z0-9.-]/g, '_');
    const storageKey = `journey/${Date.now()}_${Math.random().toString(36).substring(2, 8)}_${sanitizedName}`;

    const command = new CreateMultipartUploadCommand({
      Bucket: bucketName,
      Key: storageKey,
      ContentType: mimeType
    });

    const res = await s3Client.send(command);

    return {
      uploadId: res.UploadId,
      storageKey,
      fileUrl: `/api/media/file?key=${encodeURIComponent(storageKey)}`
    };
  },

  getPresignedPartUrl: async (storageKey, uploadId, partNumber, expiresIn = 3600) => {
    const { s3Client, bucketName } = getS3Config();

    let cleanKey = storageKey || '';
    if (cleanKey.includes('.amazonaws.com/')) {
      cleanKey = cleanKey.split('.amazonaws.com/')[1];
    }
    cleanKey = decodeURIComponent(cleanKey);

    const command = new UploadPartCommand({
      Bucket: bucketName,
      Key: cleanKey,
      UploadId: uploadId,
      PartNumber: partNumber
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn });

    return {
      partNumber,
      uploadUrl
    };
  },

  completeMultipartUpload: async (storageKey, uploadId, parts) => {
    const { s3Client, bucketName } = getS3Config();

    let cleanKey = storageKey || '';
    if (cleanKey.includes('.amazonaws.com/')) {
      cleanKey = cleanKey.split('.amazonaws.com/')[1];
    }
    cleanKey = decodeURIComponent(cleanKey);

    const formattedParts = parts.map(p => ({
      ETag: p.ETag || p.etag,
      PartNumber: parseInt(p.PartNumber || p.partNumber, 10)
    })).sort((a, b) => a.PartNumber - b.PartNumber);

    const command = new CompleteMultipartUploadCommand({
      Bucket: bucketName,
      Key: cleanKey,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: formattedParts
      }
    });

    await s3Client.send(command);

    return {
      storageKey: cleanKey,
      fileUrl: `/api/media/file?key=${encodeURIComponent(cleanKey)}`
    };
  },

  abortMultipartUpload: async (storageKey, uploadId) => {
    const { s3Client, bucketName } = getS3Config();

    let cleanKey = storageKey || '';
    if (cleanKey.includes('.amazonaws.com/')) {
      cleanKey = cleanKey.split('.amazonaws.com/')[1];
    }
    cleanKey = decodeURIComponent(cleanKey);

    const command = new AbortMultipartUploadCommand({
      Bucket: bucketName,
      Key: cleanKey,
      UploadId: uploadId
    });

    await s3Client.send(command);
    return true;
  },

  uploadFile: async (fileBuffer, fileName, mimeType) => {
    const { s3Client, bucketName } = getS3Config();

    const sanitizedName = (fileName || 'media').replace(/[^a-zA-Z0-9.-]/g, '_');
    const storageKey = `journey/${Date.now()}_${Math.random().toString(36).substring(2, 8)}_${sanitizedName}`;
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: storageKey,
      Body: fileBuffer,
      ContentType: mimeType
    });

    await s3Client.send(command);

    return {
      storageKey,
      fileUrl: `/api/media/file?key=${encodeURIComponent(storageKey)}`
    };
  },

  deleteFile: async (storageKey) => {
    const { s3Client, bucketName } = getS3Config();

    let cleanKey = storageKey || '';
    if (cleanKey.includes('.amazonaws.com/')) {
      cleanKey = cleanKey.split('.amazonaws.com/')[1];
    }
    cleanKey = decodeURIComponent(cleanKey);

    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: cleanKey
    });

    await s3Client.send(command);
    return true;
  },

  getObjectStream: async (storageKey, rangeHeader) => {
    const { s3Client, bucketName } = getS3Config();

    let cleanKey = storageKey || '';
    if (cleanKey.includes('.amazonaws.com/')) {
      cleanKey = cleanKey.split('.amazonaws.com/')[1];
    }
    cleanKey = decodeURIComponent(cleanKey);

    const commandInput = {
      Bucket: bucketName,
      Key: cleanKey
    };

    if (rangeHeader) {
      commandInput.Range = rangeHeader;
    }

    const command = new GetObjectCommand(commandInput);
    return await s3Client.send(command);
  },

  getFileUrl: (storageKey) => {
    if (!storageKey) return '';
    let cleanKey = storageKey;
    if (cleanKey.includes('.amazonaws.com/')) {
      cleanKey = cleanKey.split('.amazonaws.com/')[1];
    }
    return `/api/media/file?key=${encodeURIComponent(cleanKey)}`;
  }
};
