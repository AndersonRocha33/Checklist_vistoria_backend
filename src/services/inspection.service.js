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
      return latestInspection;
    }

    const createdInspection = await prisma.$transaction(async (db) => {
      const inspectionRecord = await inspectionRepository.create(
        {
          apartmentId,
          userId,
          reopenedFromPending: false,
          editingAfterCompletion: false,
          editedAfterCompletion: false
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

  async startCompletedEdit({ id, userId }) {
    const inspection = await inspectionRepository.findDetailedById(id);

    if (!inspection) {
      throw new NotFoundError('Vistoria não encontrada.');
    }

    if (inspection.status !== 'CONCLUIDA') {
      throw new ValidationError('Somente vistorias concluídas podem entrar no modo de edição.');
    }

    return inspectionRepository.update(id, {
      editingAfterCompletion: true,
      lastEditedById: userId
    });
  }

  async finishCompletedEdit({ id, userId }) {
    const inspection = await inspectionRepository.findDetailedById(id);

    if (!inspection) {
      throw new NotFoundError('Vistoria não encontrada.');
    }

    if (inspection.status !== 'CONCLUIDA') {
      throw new ValidationError('Esta vistoria não está concluída.');
    }

    if (!inspection.editingAfterCompletion) {
      throw new ValidationError('A vistoria não está no modo de edição.');
    }

    const updatedInspection = await inspectionRepository.update(id, {
      editingAfterCompletion: false,
      editedAfterCompletion: true,
      lastEditedAt: new Date(),
      lastEditedById: userId
    });

    return {
      message: 'Alterações da vistoria salvas com sucesso.',
      inspection: updatedInspection
    };
  }

  async assertItemCanBeEdited(itemId, userId, db = prisma) {
    const inspectionItem = await inspectionItemRepository.findDetailedById(itemId, db);

    if (!inspectionItem) {
      throw new NotFoundError('Item da vistoria não encontrado.');
    }

    const ownerId = inspectionItem.checklistItem?.apartment?.enterprise?.ownerId;

    if (ownerId && ownerId !== userId) {
      throw new NotFoundError('Item não encontrado para este usuário.');
    }

    if (
      inspectionItem.inspection.status === 'CONCLUIDA' &&
      !inspectionItem.inspection.editingAfterCompletion
    ) {
      throw new ValidationError(
        'Esta vistoria está concluída. Ative o modo de edição antes de alterar os itens.'
      );
    }

    return inspectionItem;
  }

  async updateItem(itemId, data, userId) {
    const inspectionItem = await this.assertItemCanBeEdited(itemId, userId);

    const updatedItem = await prisma.$transaction(async (db) => {
      const item = await inspectionItemRepository.update(itemId, data, db);

      if (inspectionItem.inspection.status === 'CONCLUIDA') {
        await inspectionRepository.update(
          inspectionItem.inspectionId,
          {
            editedAfterCompletion: true,
            lastEditedAt: new Date(),
            lastEditedById: userId
          },
          db
        );
      }

      return item;
    });

    return updatedItem;
  }

  async updateItemsBatch(data, userId) {
    if (!Array.isArray(data.itemIds) || data.itemIds.length === 0) {
      throw new ValidationError('Informe ao menos um item para atualização em massa.');
    }

    const items = await inspectionItemRepository.findManyByIds(data.itemIds);

    if (items.length !== data.itemIds.length) {
      throw new NotFoundError('Um ou mais itens da vistoria não foram encontrados.');
    }

    const inspectionIds = [...new Set(items.map((item) => item.inspectionId))];

    if (inspectionIds.length !== 1) {
      throw new ValidationError('Os itens selecionados precisam pertencer à mesma vistoria.');
    }

    const inspection = await inspectionRepository.findDetailedById(inspectionIds[0]);

    if (!inspection) {
      throw new NotFoundError('Vistoria não encontrada.');
    }

    const ownerId = inspection.apartment?.enterprise?.ownerId;

    if (ownerId && ownerId !== userId) {
      throw new NotFoundError('Vistoria não encontrada para este usuário.');
    }

    if (inspection.status === 'CONCLUIDA' && !inspection.editingAfterCompletion) {
      throw new ValidationError(
        'Esta vistoria está concluída. Ative o modo de edição antes de alterar os itens.'
      );
    }

    await prisma.$transaction(async (db) => {
      await inspectionItemRepository.updateManyByIds(
        data.itemIds,
        {
          status: data.status,
          ...(data.status === 'CONFORME'
            ? {
                notes: '',
                photoUrl: '',
                photoUrls: []
              }
            : {})
        },
        db
      );

      if (inspection.status === 'CONCLUIDA') {
        await inspectionRepository.update(
          inspection.id,
          {
            editedAfterCompletion: true,
            lastEditedAt: new Date(),
            lastEditedById: userId
          },
          db
        );
      }
    });

    const updatedItems = await inspectionItemRepository.findManyByIds(data.itemIds);

    return {
      message: 'Itens atualizados com sucesso.',
      items: updatedItems
    };
  }

  async deleteChecklistItemFromInspectionItem({ itemId, userId }) {
    const inspectionItem = await this.assertItemCanBeEdited(itemId, userId);

    await prisma.$transaction(async (db) => {
      await db.checklistItem.delete({
        where: {
          id: inspectionItem.checklistItemId
        }
      });

      if (inspectionItem.inspection.status === 'CONCLUIDA') {
        await inspectionRepository.update(
          inspectionItem.inspectionId,
          {
            editedAfterCompletion: true,
            lastEditedAt: new Date(),
            lastEditedById: userId
          },
          db
        );
      }
    });

    return {
      message: 'Item excluído do checklist com sucesso.'
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
      status: 'CONCLUIDA',
      finishedAt: new Date(),
      editingAfterCompletion: false
    });

    return {
      message: 'Vistoria concluída com sucesso.',
      inspection: finishedInspection
    };
  }
}

module.exports = new InspectionService();
