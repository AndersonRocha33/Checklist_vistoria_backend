const prisma = require('../lib/prisma');

class InspectionRepository {
  findOpenByApartmentId(apartmentId) {
    return prisma.inspection.findFirst({
      where: {
        apartmentId,
        status: 'EM_ANDAMENTO'
      },
      include: this.getDetailedInclude()
    });
  }

  findLatestByApartmentId(apartmentId) {
    return prisma.inspection.findFirst({
      where: { apartmentId },
      include: this.getDetailedInclude(),
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  create(data, db = prisma) {
    return db.inspection.create({
      data
    });
  }

  findDetailedById(id) {
    return prisma.inspection.findUnique({
      where: { id },
      include: this.getDetailedInclude()
    });
  }

  update(id, data, db = prisma) {
    return db.inspection.update({
      where: { id },
      data
    });
  }

  getDetailedInclude() {
    return {
      items: {
        include: {
          checklistItem: true
        }
      },
      apartment: {
        include: {
          enterprise: true
        }
      },
      user: true
    };
  }
}

module.exports = new InspectionRepository();
