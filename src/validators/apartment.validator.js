const { requireString } = require('../utils/validators');

function createApartmentSchema(payload) {
  return {
    number: requireString(
      payload.number,
      'number',
      'Número do apartamento e empreendimento são obrigatórios.'
    ),
    enterpriseId: requireString(
      payload.enterpriseId,
      'enterpriseId',
      'Número do apartamento e empreendimento são obrigatórios.'
    )
  };
}

module.exports = {
  createApartmentSchema
};
