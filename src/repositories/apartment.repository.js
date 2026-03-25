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

  findAllWithInspectionSummary() {
    return prisma.apartment.findMany({
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

  findByEnterpriseWithInspectionSummary(enterpriseId) {
    return prisma.apartment.findMany({
      where: { enterpriseId },
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

  findAllWithEnterprise(db = prisma) {
    return db.apartment.findMany({
      include: {
        enterprise: true
      }
    });
  }
}

module.exports = new ApartmentRepository();
