const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const uploadController = require('../controllers/upload.controller');
const authMiddleware = require('../middleware/auth');
const asyncHandler = require('../utils/async-handler');

const router = express.Router();

const uploadDir = path.resolve(__dirname, '../../uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

router.post('/', authMiddleware, upload.single('file'), asyncHandler(uploadController.uploadFile));
router.post('/csv', authMiddleware, upload.single('file'), asyncHandler(uploadController.importChecklistCsv));

module.exports = router;
