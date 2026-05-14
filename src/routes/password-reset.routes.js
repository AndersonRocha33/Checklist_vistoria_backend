const express = require('express');
const passwordResetController = require('../controllers/password-reset.controller');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/async-handler');
const {
  forgotPasswordSchema,
  resetPasswordSchema
} = require('../validators/password-reset.validator');

const router = express.Router();

router.post(
  '/forgot-password',
  validate(forgotPasswordSchema),
  asyncHandler(passwordResetController.forgotPassword)
);

router.post(
  '/reset-password',
  validate(resetPasswordSchema),
  asyncHandler(passwordResetController.resetPassword)
);

module.exports = router;