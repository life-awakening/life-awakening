const localStorageService = require('./localStorageService');
const s3Service = require('./s3Service');

const getStorageService = () => {
  const currentType = process.env.STORAGE_TYPE || 'local';
  if (currentType === 's3') {
    return s3Service;
  }
  return localStorageService;
};

module.exports = {
  uploadFile: async (fileBuffer, fileName, mimeType) => {
    return getStorageService().uploadFile(fileBuffer, fileName, mimeType);
  },
  deleteFile: async (storageKey) => {
    return getStorageService().deleteFile(storageKey);
  },
  getFileUrl: (storageKey, type) => {
    const currentType = type || process.env.STORAGE_TYPE || 'local';
    if (currentType === 's3') {
      return s3Service.getFileUrl(storageKey);
    }
    return localStorageService.getFileUrl(storageKey);
  },
  getPresignedUploadUrl: async (fileName, mimeType, expiresIn) => {
    return s3Service.getPresignedUploadUrl(fileName, mimeType, expiresIn);
  },
  initiateMultipartUpload: async (fileName, mimeType) => {
    return s3Service.initiateMultipartUpload(fileName, mimeType);
  },
  getPresignedPartUrl: async (storageKey, uploadId, partNumber, expiresIn) => {
    return s3Service.getPresignedPartUrl(storageKey, uploadId, partNumber, expiresIn);
  },
  completeMultipartUpload: async (storageKey, uploadId, parts) => {
    return s3Service.completeMultipartUpload(storageKey, uploadId, parts);
  },
  abortMultipartUpload: async (storageKey, uploadId) => {
    return s3Service.abortMultipartUpload(storageKey, uploadId);
  },
  configureBucketCors: async () => {
    if (process.env.STORAGE_TYPE === 's3') {
      return s3Service.configureBucketCors();
    }
    return true;
  }
};
