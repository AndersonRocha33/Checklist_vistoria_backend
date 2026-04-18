const enterpriseService = require('../services/enterprise.service');

class EnterpriseController {
  async create(req, res) {
    const enterprise = await enterpriseService.create(req.validated.body, req.user.id);
    return res.status(201).json(enterprise);
  }

  async list(req, res) {
    const enterprises = await enterpriseService.list(req.user.id);
    return res.json(enterprises);
  }
}

module.exports = new EnterpriseController();
