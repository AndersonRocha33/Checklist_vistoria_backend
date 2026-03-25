const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const tokenService = require('./token.service');

class AuthService {
  async register(data) {
    const { name, email, password } = data;

    const emailNormalizado = email.trim().toLowerCase();

    const usuarioExistente = await prisma.user.findUnique({
      where: { email: emailNormalizado }
    });

    if (usuarioExistente) {
      const error = new Error('Já existe um usuário com este e-mail.');
      error.statusCode = 400;
      throw error;
    }

    const senhaHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: emailNormalizado,
        password: senhaHash
      }
    });

    const token = tokenService.generateToken({
      id: user.id,
      email: user.email
    });

    return {
      message: 'Usuário cadastrado com sucesso.',
      token,
      user: {
        id: user.id,
        nome: user.name,
        email: user.email
      }
    };
  }

  async login(data) {
    const { email, password } = data;

    const emailNormalizado = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: emailNormalizado }
    });

    if (!user) {
      const error = new Error('E-mail ou senha inválidos.');
      error.statusCode = 401;
      throw error;
    }

    const senhaValida = await bcrypt.compare(password, user.password);

    if (!senhaValida) {
      const error = new Error('E-mail ou senha inválidos.');
      error.statusCode = 401;
      throw error;
    }

    const token = tokenService.generateToken({
      id: user.id,
      email: user.email
    });

    return {
      message: 'Login realizado com sucesso.',
      token,
      user: {
        id: user.id,
        nome: user.name,
        email: user.email
      }
    };
  }
}

module.exports = new AuthService();