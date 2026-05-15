const inspectionService = require('../services/inspection.service');
const reportService = require('../services/report.service');

function parseCategoriesQuery(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .flatMap((item) => String(item).split(','))
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

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

  async deleteChecklistItem(req, res) {
    const result = await inspectionService.deleteChecklistItemFromInspectionItem({
      itemId: req.params.itemId,
      userId: req.user.id
    });

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
    try {
      const inspection = await inspectionService.getById(req.params.id);
      await reportService.generateInspectionReport(res, inspection);
    } catch (error) {
      console.error('=== ERRO AO GERAR RELATÓRIO ===');
      console.error('Inspection ID:', req.params.id);
      console.error('Mensagem:', error.message);
      console.error('Stack:', error.stack);

      return res.status(500).json({
        message: 'Erro ao gerar relatório.'
      });
    }
  }

  async generatePendingReport(req, res) {
    try {
      const inspection = await inspectionService.getById(req.params.id);
      const categories = parseCategoriesQuery(req.query.categories);

      await reportService.generatePendingInspectionReport(res, inspection, {
        categories
      });
    } catch (error) {
      console.error('=== ERRO AO GERAR RELATÓRIO DE PENDÊNCIAS ===');
      console.error('Inspection ID:', req.params.id);
      console.error('Mensagem:', error.message);
      console.error('Stack:', error.stack);

      return res.status(500).json({
        message: 'Erro ao gerar relatório de pendências.'
      });
    }
  }
}

module.exports = new InspectionController();
