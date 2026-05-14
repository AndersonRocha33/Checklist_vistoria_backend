const passwordResetService = require('../services/password-reset.service');

class PasswordResetController {
  async forgotPassword(req, res) {
    const result = await passwordResetService.forgotPassword(req.validated.body.email);
    return res.json(result);
  }

  async resetPassword(req, res) {
    const result = await passwordResetService.resetPassword(req.validated.body);
    return res.json(result);
  }
}

module.exports = new PasswordResetController();