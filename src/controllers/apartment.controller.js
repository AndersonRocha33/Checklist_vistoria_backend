const apartmentService = require('../services/apartment.service');

class ApartmentController {
  async create(req, res) {
    const apartment = await apartmentService.create(req.validated.body, req.user.id);
    return res.status(201).json(apartment);
  }

  async listAll(req, res) {
    const apartments = await apartmentService.listAll(req.user.id);
    return res.json(apartments);
  }

  async listByEnterprise(req, res) {
    const apartments = await apartmentService.listByEnterprise(req.params.enterpriseId, req.user.id);
    return res.json(apartments);
  }
}

module.exports = new ApartmentController();
