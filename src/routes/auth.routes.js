const express = require('express');
const authController = require('../controllers/auth.controller');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/async-handler');
const {
  registerSchema,
  loginSchema,
} = require('../validators/auth.validator');

const router = express.Router();

router.post(
  '/register',
  validate(registerSchema),
  asyncHandler(authController.register)
);

router.post(
  '/login',
  validate(loginSchema),
  asyncHandler(authController.login)
);

module.exports = router;
