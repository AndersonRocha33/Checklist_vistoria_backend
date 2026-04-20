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

  async remove(enterpriseId, userId) {
    const enterprise = await this.findOwnedEnterpriseOrThrow(enterpriseId, userId);

    await enterpriseRepository.deleteById(enterprise.id);

    return {
      message: 'Empreendimento excluído com sucesso.'
    };
  }
}

module.exports = new EnterpriseService();
