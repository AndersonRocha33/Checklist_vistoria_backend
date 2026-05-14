const prisma = require('../lib/prisma');

class PasswordResetRepository {
  create(data) {
    return prisma.passwordResetToken.create({
      data
    });
  }

  findValidByTokenHash(tokenHash) {
    return prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: {
          gt: new Date()
        }
      },
      include: {
        user: true
      }
    });
  }

  markAsUsed(id) {
    return prisma.passwordResetToken.update({
      where: { id },
      data: {
        usedAt: new Date()
      }
    });
  }

  invalidateUserTokens(userId) {
    return prisma.passwordResetToken.updateMany({
      where: {
        userId,
        usedAt: null
      },
      data: {
        usedAt: new Date()
      }
    });
  }
}

module.exports = new PasswordResetRepository();