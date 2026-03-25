const jwt = require('jsonwebtoken');
const { UnauthorizedError } = require('../errors/http-errors');

class TokenService {
  getSecret() {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET não configurado.');
    }

    return process.env.JWT_SECRET;
  }

  sign(user) {
    return jwt.sign(
      {
        id: user.id,
        name: user.name,
        email: user.email
      },
      this.getSecret(),
      { expiresIn: '1d' }
    );
  }

  verify(token) {
    try {
      return jwt.verify(token, this.getSecret());
    } catch (error) {
      throw new UnauthorizedError('Token inválido.');
    }
  }
}

module.exports = new TokenService();
