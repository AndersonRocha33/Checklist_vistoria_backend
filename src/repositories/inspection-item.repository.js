const prisma = require('../lib/prisma');

class InspectionItemRepository {
  createMany(data, db = prisma) {
    return db.inspectionItem.createMany({
      data
    });
  }

  findDetailedById(id, db = prisma) {
    return db.inspectionItem.findUnique({
      where: { id },
      include: {
        checklistItem: {
          include: {
            apartment: {
              include: {
                enterprise: true
              }
            }
          }
        },
        inspection: true
      }
    });
  }

  update(id, data, db = prisma) {
    return db.inspectionItem.update({
      where: { id },
      data,
      include: {
        checklistItem: true
      }
    });
  }

  updateManyByIds(ids, data, db = prisma) {
    return db.inspectionItem.updateMany({
      where: {
        id: {
          in: ids
        }
      },
      data
    });
  }

  findManyByIds(ids, db = prisma) {
    return db.inspectionItem.findMany({
      where: {
        id: {
          in: ids
        }
      },
      include: {
        checklistItem: true,
        inspection: true
      }
    });
  }
}

module.exports = new InspectionItemRepository();