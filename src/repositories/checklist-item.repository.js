const prisma = require('../lib/prisma');

class ChecklistItemRepository {
  findByApartmentId(apartmentId, db = prisma) {
    return db.checklistItem.findMany({
      where: { apartmentId }
    });
  }

  findAllWithApartmentAndEnterprise(db = prisma) {
    return db.checklistItem.findMany({
      include: {
        apartment: {
          include: {
            enterprise: true
          }
        }
      }
    });
  }

  createMany(data, db = prisma) {
    return db.checklistItem.createMany({
      data
    });
  }
}

module.exports = new ChecklistItemRepository();
