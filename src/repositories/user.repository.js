const prisma = require('../lib/prisma');

class UserRepository {
  findByEmail(email) {
    return prisma.user.findUnique({
      where: { email }
    });
  }

  findById(id) {
    return prisma.user.findUnique({
      where: { id }
    });
  }

  create(data) {
    return prisma.user.create({ data });
  }
}

module.exports = new UserRepository();
