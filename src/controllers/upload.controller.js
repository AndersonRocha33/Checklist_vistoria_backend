const uploadService = require('../services/upload.service');

class UploadController {
  async uploadFile(req, res) {
    const result = uploadService.uploadFile(req);
    return res.json(result);
  }

  async importChecklistCsv(req, res) {
    const result = await uploadService.importChecklistCsv(req);
    return res.json(result);
  }
}

module.exports = new UploadController();
