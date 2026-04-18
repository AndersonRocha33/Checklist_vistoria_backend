const tokenService = require('../services/token.service');
const userRepository = require('../repositories/user.repository');
const { UnauthorizedError } = require('../errors/http-errors');

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return next(new UnauthorizedError('Token não informado.'));
  }

  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new UnauthorizedError('Token inválido.'));
  }

  try {
    const decoded = tokenService.verify(token);

    const user = await userRepository.findById(decoded.id);

    if (!user) {
      return next(new UnauthorizedError('Usuário do token não encontrado.'));
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email
    };

    return next();
  } catch (error) {
    return next(new UnauthorizedError('Token inválido ou expirado.'));
  }
}

module.exports = authMiddleware;