const prisma = require('../lib/prisma');

class EnterpriseRepository {
  create(data, db = prisma) {
    return db.enterprise.create({ data });
  }

  list() {
    return prisma.enterprise.findMany({
      orderBy: { name: 'asc' }
    });
  }

  findManyByNames(names, db = prisma) {
    return db.enterprise.findMany({
      where: {
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
}

module.exports = new EnterpriseRepository();
