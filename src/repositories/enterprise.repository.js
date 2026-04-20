const prisma = require('../lib/prisma');

class EnterpriseRepository {
  create(data, db = prisma) {
    return db.enterprise.create({ data });
  }

  listByOwner(ownerId) {
    return prisma.enterprise.findMany({
      where: {
        ownerId
      },
      orderBy: { name: 'asc' }
    });
  }

  findManyByNamesAndOwner(names, ownerId, db = prisma) {
    return db.enterprise.findMany({
      where: {
        ownerId,
        name: {
          in: names
        }
      }
    });
  }

  findById(id) {
    return prisma.enterprise.findUnique({
      where: { id }
    });
  }

  findByIdAndOwner(id, ownerId) {
    return prisma.enterprise.findFirst({
      where: {
        id,
        ownerId
      }
    });
  }

  deleteById(id, db = prisma) {
    return db.enterprise.delete({
      where: { id }
    });
  }
}

module.exports = new EnterpriseRepository();