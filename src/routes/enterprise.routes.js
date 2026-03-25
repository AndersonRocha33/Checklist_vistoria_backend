const express = require('express');
const enterpriseController = require('../controllers/enterprise.controller');
const authMiddleware = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/async-handler');
const { createEnterpriseSchema } = require('../validators/enterprise.validator');

const router = express.Router();

router.post(
  '/',
  authMiddleware,
  validate(createEnterpriseSchema),
  asyncHandler(enterpriseController.create)
);
router.get('/', authMiddleware, asyncHandler(enterpriseController.list));

module.exports = router;
