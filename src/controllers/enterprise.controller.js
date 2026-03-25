const enterpriseService = require('../services/enterprise.service');

class EnterpriseController {
  async create(req, res) {
    const enterprise = await enterpriseService.create(req.validated.body);
    return res.status(201).json(enterprise);
  }

  async list(req, res) {
    const enterprises = await enterpriseService.list();
    return res.json(enterprises);
  }
}

module.exports = new EnterpriseController();
