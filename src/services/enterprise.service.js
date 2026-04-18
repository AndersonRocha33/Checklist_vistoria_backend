const enterpriseRepository = require('../repositories/enterprise.repository');
const { NotFoundError } = require('../errors/http-errors');

class EnterpriseService {
  create(data, userId) {
    return enterpriseRepository.create({
      name: data.name,
      ownerId: userId
    });
  }

  list(userId) {
    return enterpriseRepository.listByOwner(userId);
  }

  async findOwnedEnterpriseOrThrow(enterpriseId, userId) {
    const enterprise = await enterpriseRepository.findByIdAndOwner(enterpriseId, userId);

    if (!enterprise) {
      throw new NotFoundError('Empreendimento não encontrado para este usuário.');
    }

    return enterprise;
  }
}

module.exports = new EnterpriseService();
