const express = require('express');
const inspectionController = require('../controllers/inspection.controller');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.post('/start', authMiddleware, inspectionController.start);
router.put('/items/batch', authMiddleware, inspectionController.updateItemsBatch);
router.put('/:id/signatures', authMiddleware, inspectionController.saveSignatures);
router.get('/:id/report', authMiddleware, inspectionController.generateReport);
router.get('/:id', authMiddleware, inspectionController.getById);
router.put('/item/:itemId', authMiddleware, inspectionController.updateItem);
router.put('/:id/finish', authMiddleware, inspectionController.finish);

module.exports = router;