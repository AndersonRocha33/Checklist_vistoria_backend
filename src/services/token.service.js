const jwt = require('jsonwebtoken');

class TokenService {
  getSecret() {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new Error('JWT_SECRET não configurado.');
    }

    return secret;
  }

  generateToken(payload) {
    const secret = this.getSecret();

    return jwt.sign(payload, secret, {
      expiresIn: '7d',
    });
  }

  verifyToken(token) {
    const secret = this.getSecret();

    return jwt.verify(token, secret);
  }
}

module.exports = new TokenService();