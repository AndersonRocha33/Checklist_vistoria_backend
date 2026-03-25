const express = require('express');
const apartmentController = require('../controllers/apartment.controller');
const authMiddleware = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/async-handler');
const { createApartmentSchema } = require('../validators/apartment.validator');

const router = express.Router();

router.post(
  '/',
  authMiddleware,
  validate(createApartmentSchema),
  asyncHandler(apartmentController.create)
);
router.get('/', authMiddleware, asyncHandler(apartmentController.listAll));
router.get(
  '/enterprise/:enterpriseId',
  authMiddleware,
  asyncHandler(apartmentController.listByEnterprise)
);

module.exports = router;
