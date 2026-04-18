const prisma = require('../lib/prisma');

class ApartmentRepository {
  create(data, db = prisma) {
    return db.apartment.create({
      data,
      include: {
        enterprise: true
      }
    });
  }

  findByComposite(number, enterpriseId, db = prisma) {
    return db.apartment.findUnique({
      where: {
        number_enterpriseId: {
          number,
          enterpriseId
        }
      }
    });
  }

  findAllWithInspectionSummaryByOwner(ownerId) {
    return prisma.apartment.findMany({
      where: {
        enterprise: {
          ownerId
        }
      },
      include: {
        enterprise: true,
        checklistItems: true,
        inspections: {
          include: {
            items: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      },
      orderBy: [
        { enterprise: { name: 'asc' } },
        { number: 'asc' }
      ]
    });
  }

  findByEnterpriseWithInspectionSummaryAndOwner(enterpriseId, ownerId) {
    return prisma.apartment.findMany({
      where: {
        enterpriseId,
        enterprise: {
          ownerId
        }
      },
      include: {
        enterprise: true,
        checklistItems: true,
        inspections: {
          include: {
            items: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      },
      orderBy: { number: 'asc' }
    });
  }

  findAllWithEnterpriseByOwner(ownerId, db = prisma) {
    return db.apartment.findMany({
      where: {
        enterprise: {
          ownerId
        }
      },
      include: {
        enterprise: true
      }
    });
  }
}

module.exports = new ApartmentRepository();
