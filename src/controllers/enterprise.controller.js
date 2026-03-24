const prisma = require('../lib/prisma');

class EnterpriseController {
  async create(req, res) {
    try {
      const { name } = req.body;

      if (!name) {
        return res.status(400).json({ message: 'Nome do empreendimento é obrigatório.' });
      }

      const enterprise = await prisma.enterprise.create({
        data: { name }
      });

      return res.status(201).json(enterprise);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Erro ao criar empreendimento.' });
    }
  }

  async list(req, res) {
    try {
      const enterprises = await prisma.enterprise.findMany({
        orderBy: { name: 'asc' }
      });

      return res.json(enterprises);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Erro ao listar empreendimentos.' });
    }
  }
}

module.exports = new EnterpriseController();