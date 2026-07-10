const express = require('express');
const inspectionController = require('../controllers/inspection.controller');
const authMiddleware = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/async-handler');
const {
  startInspectionSchema,
  updateInspectionItemSchema,
  updateInspectionItemsBatchSchema,
  saveSignaturesSchema
} = require('../validators/inspection.validator');

const router = express.Router();

router.post(
  '/start',
  authMiddleware,
  validate(startInspectionSchema),
  asyncHandler(inspectionController.start)
);

router.put(
  '/items/batch',
  authMiddleware,
  validate(updateInspectionItemsBatchSchema),
  asyncHandler(inspectionController.updateItemsBatch)
);

router.put(
  '/:id/edit/start',
  authMiddleware,
  asyncHandler(inspectionController.startCompletedEdit)
);

router.put(
  '/:id/edit/finish',
  authMiddleware,
  asyncHandler(inspectionController.finishCompletedEdit)
);

router.put(
  '/:id/signatures',
  authMiddleware,
  validate(saveSignaturesSchema),
  asyncHandler(inspectionController.saveSignatures)
);

router.get(
  '/:id/report',
  authMiddleware,
  asyncHandler(inspectionController.generateReport)
);

router.get(
  '/:id/pending-report',
  authMiddleware,
  asyncHandler(inspectionController.generatePendingReport)
);

router.get(
  '/:id',
  authMiddleware,
  asyncHandler(inspectionController.getById)
);

router.delete(
  '/item/:itemId/checklist',
  authMiddleware,
  asyncHandler(inspectionController.deleteChecklistItem)
);

router.put(
  '/item/:itemId',
  authMiddleware,
  validate(updateInspectionItemSchema),
  asyncHandler(inspectionController.updateItem)
);

router.put(
  '/:id/finish',
  authMiddleware,
  asyncHandler(inspectionController.finish)
);

module.exports = router;
