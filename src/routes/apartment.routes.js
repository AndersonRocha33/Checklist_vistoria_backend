const express = require('express');
const apartmentController = require('../controllers/apartment.controller');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.post('/', authMiddleware, (req, res) => apartmentController.create(req, res));
router.get('/', authMiddleware, (req, res) => apartmentController.listAll(req, res));
router.get(
  '/enterprise/:enterpriseId',
  authMiddleware,
  (req, res) => apartmentController.listByEnterprise(req, res)
);

module.exports = router;