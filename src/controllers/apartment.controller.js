const apartmentService = require('../services/apartment.service');

class ApartmentController {
  async create(req, res) {
    const apartment = await apartmentService.create(req.validated.body);
    return res.status(201).json(apartment);
  }

  async listAll(req, res) {
    const apartments = await apartmentService.listAll();
    return res.json(apartments);
  }

  async listByEnterprise(req, res) {
    const apartments = await apartmentService.listByEnterprise(req.params.enterpriseId);
    return res.json(apartments);
  }
}

module.exports = new ApartmentController();
