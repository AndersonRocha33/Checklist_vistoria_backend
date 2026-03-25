const { requireString } = require('../utils/validators');

function createEnterpriseSchema(payload) {
  return {
    name: requireString(payload.name, 'name', 'Nome do empreendimento é obrigatório.')
  };
}

module.exports = {
  createEnterpriseSchema
};
