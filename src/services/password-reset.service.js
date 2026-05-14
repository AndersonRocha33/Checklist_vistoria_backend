const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const passwordResetRepository = require('../repositories/password-reset.repository');
const mailService = require('./mail.service');
const { ValidationError } = require('../errors/http-errors');

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

class PasswordResetService {
  async forgotPassword(email) {
    const user = await prisma.user.findUnique({
      where: {
        email
      }
    });

    if (!user) {
      return {
        message: 'Se o e-mail estiver cadastrado, enviaremos um link para redefinir a senha.'
      };
    }

    await passwordResetRepository.invalidateUserTokens(user.id);

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await passwordResetRepository.create({
      userId: user.id,
      tokenHash,
      expiresAt
    });

    const frontendUrl = process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:5173';
    const resetLink = `${frontendUrl}/reset-password?token=${rawToken}`;

    await mailService.sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetLink
    });

    return {
      message: 'Se o e-mail estiver cadastrado, enviaremos um link para redefinir a senha.'
    };
  }

  async resetPassword({ token, password }) {
    if (password.length < 6) {
      throw new ValidationError('A nova senha deve ter no mínimo 6 caracteres.');
    }

    const tokenHash = hashToken(token);

    const resetToken = await passwordResetRepository.findValidByTokenHash(tokenHash);

    if (!resetToken) {
      throw new ValidationError('Link inválido ou expirado. Solicite uma nova redefinição de senha.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.$transaction(async (db) => {
      await db.user.update({
        where: {
          id: resetToken.userId
        },
        data: {
          password: hashedPassword
        }
      });

      await db.passwordResetToken.update({
        where: {
          id: resetToken.id
        },
        data: {
          usedAt: new Date()
        }
      });
    });

    return {
      message: 'Senha redefinida com sucesso. Faça login com a nova senha.'
    };
  }
}

module.exports = new PasswordResetService();