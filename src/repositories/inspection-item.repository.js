const prisma = require('../lib/prisma');

class InspectionItemRepository {
  createMany(data, db = prisma) {
    return db.inspectionItem.createMany({
      data
    });
  }

  update(id, data) {
    return prisma.inspectionItem.update({
      where: { id },
      data,
      include: {
        checklistItem: true
      }
    });
  }

  updateManyByIds(ids, data) {
    return prisma.inspectionItem.updateMany({
      where: {
        id: {
          in: ids
        }
      },
      data
    });
  }

  findManyByIds(ids) {
    return prisma.inspectionItem.findMany({
      where: {
        id: {
          in: ids
        }
      },
      include: {
        checklistItem: true
      }
    });
  }
}

module.exports = new InspectionItemRepository();
