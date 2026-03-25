const enterpriseRepository = require('../repositories/enterprise.repository');

class EnterpriseService {
  create(data) {
    return enterpriseRepository.create({
      name: data.name
    });
  }

  list() {
    return enterpriseRepository.list();
  }
}

module.exports = new EnterpriseService();
