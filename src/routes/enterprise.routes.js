const express = require('express');
const enterpriseController = require('../controllers/enterprise.controller');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.post('/', authMiddleware, enterpriseController.create);
router.get('/', authMiddleware, enterpriseController.list);

module.exports = router;