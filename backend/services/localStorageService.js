const fs = require('fs');
const path = require('path');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads', 'journey');

// Ensure directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

module.exports = {
  uploadFile: async (fileBuffer, fileName, mimeType) => {
    const filePath = path.join(UPLOADS_DIR, fileName);
    await fs.promises.writeFile(filePath, fileBuffer);
    return {
      storageKey: fileName,
      fileUrl: `/uploads/journey/${fileName}`
    };
  },

  deleteFile: async (storageKey) => {
    const filePath = path.join(UPLOADS_DIR, storageKey);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
    return true;
  },

  getFileUrl: (storageKey) => {
    return `/uploads/journey/${storageKey}`;
  }
};
