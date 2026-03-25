const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const tokenService = require('./token.service');

class AuthService {
  async register(data) {
    const { name, email, password } = data;

    const normalizedName = String(name || '').trim();
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedPassword = String(password || '').trim();

    const existingUser = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (existingUser) {
      const error = new Error('Já existe um usuário com este e-mail.');
      error.statusCode = 400;
      throw error;
    }

    const hashedPassword = await bcrypt.hash(normalizedPassword, 10);

    const user = await prisma.user.create({
      data: {
        name: normalizedName,
        email: normalizedEmail,
        password: hashedPassword,
      },
    });

    const token = tokenService.generateToken({
      id: user.id,
      email: user.email,
    });

    return {
      message: 'Usuário cadastrado com sucesso.',
      token,
      user: {
        id: user.id,
        nome: user.name,
        email: user.email,
      },
    };
  }

  async login(data) {
    const { email, password } = data;

    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedPassword = String(password || '').trim();

    const user = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (!user) {
      const error = new Error('E-mail ou senha inválidos.');
      error.statusCode = 401;
      throw error;
    }

    const passwordMatch = await bcrypt.compare(
      normalizedPassword,
      user.password
    );

    if (!passwordMatch) {
      const error = new Error('E-mail ou senha inválidos.');
      error.statusCode = 401;
      throw error;
    }

    const token = tokenService.generateToken({
      id: user.id,
      email: user.email,
    });

    return {
      message: 'Login realizado com sucesso.',
      token,
      user: {
        id: user.id,
        nome: user.name,
        email: user.email,
      },
    };
  }
}

module.exports = new AuthService();