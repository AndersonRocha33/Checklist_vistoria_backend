const inspectionService = require('../services/inspection.service');
const reportService = require('../services/report.service');

class InspectionController {
  async start(req, res) {
    const inspection = await inspectionService.start({
      apartmentId: req.validated.body.apartmentId,
      userId: req.user.id
    });

    return res.json(inspection);
  }

  async getById(req, res) {
    const inspection = await inspectionService.getById(req.params.id);
    return res.json(inspection);
  }

  async updateItem(req, res) {
    const updated = await inspectionService.updateItem(req.params.itemId, req.validated.body);
    return res.json(updated);
  }

  async updateItemsBatch(req, res) {
    const result = await inspectionService.updateItemsBatch(req.validated.body);
    return res.json(result);
  }

  async saveSignatures(req, res) {
    const result = await inspectionService.saveSignatures(req.params.id, req.validated.body);
    return res.json(result);
  }

  async finish(req, res) {
    const result = await inspectionService.finish(req.params.id);
    return res.json(result);
  }

  async generateReport(req, res) {
    const inspection = await inspectionService.getById(req.params.id);
    await reportService.generateInspectionReport(res, inspection);
  }
}

module.exports = new InspectionController();
