const authService = require('../services/auth.service');

class AuthController {
  async register(req, res) {
    const result = await authService.register(req.validated.body);
    return res.status(201).json(result);
  }

  async login(req, res) {
    const result = await authService.login(req.validated.body);
    return res.status(200).json(result);
  }
}

module.exports = new AuthController();
