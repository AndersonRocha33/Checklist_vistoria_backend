const prisma = require('../lib/prisma');

class ApartmentController {
  async create(req, res) {
    try {
      const { number, enterpriseId } = req.body;

      if (!number || !enterpriseId) {
        return res.status(400).json({
          message: 'Número do apartamento e empreendimento são obrigatórios.'
        });
      }

      const apartment = await prisma.apartment.create({
        data: {
          number: String(number),
          enterpriseId
        }
      });

      return res.status(201).json(apartment);
    } catch (error) {
      console.error('Erro ao criar apartamento:', error);
      return res.status(500).json({
        message: 'Erro ao criar apartamento.',
        error: error.message
      });
    }
  }

  getApartmentInspectionStatus(apartment) {
    if (!apartment.inspections || apartment.inspections.length === 0) {
      return 'NAO_VISTORIADO';
    }

    const latestInspection = apartment.inspections[0];

    if (latestInspection.status === 'EM_ANDAMENTO') {
      return 'EM_VISTORIA';
    }

    const hasPendingItems = latestInspection.items.some(
      (item) => item.status !== 'CONFORME'
    );

    if (hasPendingItems) {
      return 'VISTORIADO_COM_PENDENCIA';
    }

    return 'VISTORIADO';
  }

  getInspectionCounters(apartment) {
    if (!apartment.inspections || apartment.inspections.length === 0) {
      return {
        conformeCount: 0,
        naoConformeCount: 0,
        pendenteCount: apartment.checklistItems.length
      };
    }

    const latestInspection = apartment.inspections[0];

    const conformeCount = latestInspection.items.filter(
      (item) => item.status === 'CONFORME'
    ).length;

    const naoConformeCount = latestInspection.items.filter(
      (item) => item.status === 'NAO_CONFORME'
    ).length;

    const pendenteCount = latestInspection.items.filter(
      (item) => item.status === 'PENDENTE'
    ).length;

    return {
      conformeCount,
      naoConformeCount,
      pendenteCount
    };
  }

  mapApartment(apartment) {
    const counters = this.getInspectionCounters(apartment);

    return {
      id: apartment.id,
      number: apartment.number,
      enterpriseId: apartment.enterpriseId,
      enterpriseName: apartment.enterprise?.name || '',
      totalDistinctItems: apartment.checklistItems.length,
      inspectionStatus: this.getApartmentInspectionStatus(apartment),
      conformeCount: counters.conformeCount,
      naoConformeCount: counters.naoConformeCount,
      pendenteCount: counters.pendenteCount
    };
  }

  async listAll(req, res) {
    try {
      const apartments = await prisma.apartment.findMany({
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

      return res.json(apartments.map((apartment) => this.mapApartment(apartment)));
    } catch (error) {
      console.error('Erro ao listar todos os apartamentos:', error);
      return res.status(500).json({
        message: 'Erro ao listar apartamentos.',
        error: error.message
      });
    }
  }

  async listByEnterprise(req, res) {
    try {
      const { enterpriseId } = req.params;

      const apartments = await prisma.apartment.findMany({
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

      return res.json(apartments.map((apartment) => this.mapApartment(apartment)));
    } catch (error) {
      console.error('Erro ao listar apartamentos:', error);
      return res.status(500).json({
        message: 'Erro ao listar apartamentos.',
        error: error.message
      });
    }
  }
}

module.exports = new ApartmentController();