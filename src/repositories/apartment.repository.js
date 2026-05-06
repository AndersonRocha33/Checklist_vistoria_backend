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

  findByComposite(number, enterpriseId) {
    return prisma.apartment.findUnique({
      where: {
        number_enterpriseId: {
          number,
          enterpriseId
        }
      }
    });
  }

  findAllWithInspectionSummary(ownerId = null) {
    return prisma.apartment.findMany({
      where: ownerId
        ? {
            enterprise: {
              ownerId
            }
          }
        : undefined,
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

  findByEnterpriseWithInspectionSummary(enterpriseId, ownerId = null) {
    return prisma.apartment.findMany({
      where: {
        enterpriseId,
        ...(ownerId
          ? {
              enterprise: {
                ownerId
              }
            }
          : {})
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
      orderBy: {
        number: 'asc'
      }
    });
  }

  findAllWithEnterprise(db = prisma) {
    return db.apartment.findMany({
      include: {
        enterprise: true
      }
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
