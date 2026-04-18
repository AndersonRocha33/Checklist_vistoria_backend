const apartmentRepository = require('../repositories/apartment.repository');
const enterpriseRepository = require('../repositories/enterprise.repository');
const { ConflictError, NotFoundError } = require('../errors/http-errors');

class ApartmentService {
  async create(data, userId) {
    const enterprise = await enterpriseRepository.findByIdAndOwner(data.enterpriseId, userId);

    if (!enterprise) {
      throw new NotFoundError('Empreendimento não encontrado para este usuário.');
    }

    const existingApartment = await apartmentRepository.findByComposite(
      String(data.number),
      data.enterpriseId
    );

    if (existingApartment) {
      throw new ConflictError('Apartamento já cadastrado para este empreendimento.');
    }

    return apartmentRepository.create({
      number: String(data.number),
      enterpriseId: data.enterpriseId
    });
  }

  async listAll(userId) {
    const apartments = await apartmentRepository.findAllWithInspectionSummaryByOwner(userId);
    return apartments.map((apartment) => this.mapApartment(apartment));
  }

  async listByEnterprise(enterpriseId, userId) {
    const enterprise = await enterpriseRepository.findByIdAndOwner(enterpriseId, userId);

    if (!enterprise) {
      throw new NotFoundError('Empreendimento não encontrado para este usuário.');
    }

    const apartments = await apartmentRepository.findByEnterpriseWithInspectionSummaryAndOwner(
      enterpriseId,
      userId
    );

    return apartments.map((apartment) => this.mapApartment(apartment));
  }

  getApartmentInspectionStatus(apartment) {
    if (!apartment.inspections || apartment.inspections.length === 0) {
      return 'NAO_VISTORIADO';
    }

    const latestInspection = apartment.inspections[0];

    if (latestInspection.status === 'EM_ANDAMENTO') {
      return 'EM_VISTORIA';
    }

    const hasPendingItems = latestInspection.items.some((item) => item.status !== 'CONFORME');

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

    return {
      conformeCount: latestInspection.items.filter((item) => item.status === 'CONFORME').length,
      naoConformeCount: latestInspection.items.filter((item) => item.status === 'NAO_CONFORME').length,
      pendenteCount: latestInspection.items.filter((item) => item.status === 'PENDENTE').length
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
}

module.exports = new ApartmentService();