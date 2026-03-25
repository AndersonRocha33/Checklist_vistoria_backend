const {
  requireString,
  optionalString,
  requireEnum,
  requireArray,
  optionalBase64Image
} = require('../utils/validators');

const allowedStatuses = ['PENDENTE', 'CONFORME', 'NAO_CONFORME'];

function startInspectionSchema(payload) {
  return {
    apartmentId: requireString(payload.apartmentId, 'apartmentId', 'Apartment ID é obrigatório.')
  };
}

function updateInspectionItemSchema(payload) {
  return {
    status: requireEnum(payload.status, allowedStatuses, 'status', 'Status inválido.'),
    notes: optionalString(payload.notes),
    photoUrl: optionalString(payload.photoUrl)
  };
}

function updateInspectionItemsBatchSchema(payload) {
  return {
    itemIds: requireArray(
      payload.itemIds,
      'itemIds',
      'Informe ao menos um item para atualização em massa.'
    ),
    status: requireEnum(
      payload.status,
      allowedStatuses,
      'status',
      'Status inválido para atualização em massa.'
    )
  };
}

function saveSignaturesSchema(payload) {
  const inspectorSignature = optionalBase64Image(
    payload.inspectorSignature,
    'inspectorSignature',
    'Assinatura do vistoriador em formato inválido.'
  );
  const clientSignature = optionalBase64Image(
    payload.clientSignature,
    'clientSignature',
    'Assinatura do cliente em formato inválido.'
  );

  if (inspectorSignature === undefined && clientSignature === undefined) {
    const error = new Error('Nenhuma assinatura foi enviada para salvar.');
    error.details = null;
    throw error;
  }

  return {
    inspectorSignature,
    clientSignature
  };
}

module.exports = {
  startInspectionSchema,
  updateInspectionItemSchema,
  updateInspectionItemsBatchSchema,
  saveSignaturesSchema
};
