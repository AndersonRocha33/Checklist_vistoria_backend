const prisma = require('../lib/prisma');
const inspectionRepository = require('../repositories/inspection.repository');
const inspectionItemRepository = require('../repositories/inspection-item.repository');
const checklistItemRepository = require('../repositories/checklist-item.repository');
const { NotFoundError, ValidationError } = require('../errors/http-errors');

class InspectionService {
  async start({ apartmentId, userId }) {
    const openInspection = await inspectionRepository.findOpenByApartmentId(apartmentId);

    if (openInspection) {
      return openInspection;
    }

    const latestInspection = await inspectionRepository.findLatestByApartmentId(apartmentId);

    if (latestInspection) {
      const hasPendingItems = latestInspection.items.some((item) => item.status !== 'CONFORME');

      if (latestInspection.status === 'CONCLUIDA' && hasPendingItems) {
        await inspectionRepository.update(latestInspection.id, {
          status: 'EM_ANDAMENTO',
          reopenedFromPending: true,
          userId
        });

        return inspectionRepository.findDetailedById(latestInspection.id);
      }

      if (latestInspection.status === 'CONCLUIDA' && !hasPendingItems) {
        return latestInspection;
      }

      return latestInspection;
    }

    const createdInspection = await prisma.$transaction(async (db) => {
      const inspectionRecord = await inspectionRepository.create(
        {
          apartmentId,
          userId,
          reopenedFromPending: false
        },
        db
      );

      const checklistItems = await checklistItemRepository.findByApartmentId(apartmentId, db);

      if (checklistItems.length > 0) {
        await inspectionItemRepository.createMany(
          checklistItems.map((item) => ({
            inspectionId: inspectionRecord.id,
            checklistItemId: item.id,
            status: 'PENDENTE'
          })),
          db
        );
      }

      return inspectionRecord;
    });

    return inspectionRepository.findDetailedById(createdInspection.id);
  }

  async getById(id) {
    const inspection = await inspectionRepository.findDetailedById(id);

    if (!inspection) {
      throw new NotFoundError('Vistoria não encontrada.');
    }

    return inspection;
  }

  updateItem(itemId, data) {
    return inspectionItemRepository.update(itemId, data);
  }

  async updateItemsBatch(data) {
    await inspectionItemRepository.updateManyByIds(data.itemIds, {
      status: data.status
    });

    const updatedItems = await inspectionItemRepository.findManyByIds(data.itemIds);

    return {
      message: 'Itens atualizados com sucesso.',
      items: updatedItems
    };
  }

  async saveSignatures(id, data) {
    const inspection = await inspectionRepository.findDetailedById(id);

    if (!inspection) {
      throw new NotFoundError('Vistoria não encontrada.');
    }

    const dataToUpdate = {};

    if (data.inspectorSignature !== undefined) {
      dataToUpdate.inspectorSignature = data.inspectorSignature;
    }

    if (data.clientSignature !== undefined) {
      dataToUpdate.clientSignature = data.clientSignature;
    }

    if (Object.keys(dataToUpdate).length === 0) {
      throw new ValidationError('Nenhuma assinatura foi enviada para salvar.');
    }

    const updatedInspection = await inspectionRepository.update(id, dataToUpdate);

    return {
      message: 'Assinatura(s) salva(s) com sucesso.',
      inspection: updatedInspection
    };
  }

  async finish(id) {
    const inspection = await inspectionRepository.findDetailedById(id);

    if (!inspection) {
      throw new NotFoundError('Vistoria não encontrada.');
    }

    if (!inspection.inspectorSignature || !inspection.clientSignature) {
      throw new ValidationError(
        'Salve as assinaturas do vistoriador e do cliente antes de finalizar.'
      );
    }

    const finishedInspection = await inspectionRepository.update(id, {
      status: 'CONCLUIDA'
    });

    return {
      message: 'Vistoria concluída com sucesso.',
      inspection: finishedInspection
    };
  }
}

module.exports = new InspectionService();
