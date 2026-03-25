const { requireString } = require('../utils/validators');

function registerSchema(payload) {
  return {
    nome: requireString(payload.nome, 'nome', 'Nome, email e senha são obrigatórios.'),
    email: requireString(payload.email, 'email', 'Nome, email e senha são obrigatórios.'),
    senha: requireString(payload.senha, 'senha', 'Nome, email e senha são obrigatórios.')
  };
}

function loginSchema(payload) {
  return {
    email: requireString(payload.email, 'email', 'Email e senha são obrigatórios.'),
    senha: requireString(payload.senha, 'senha', 'Email e senha são obrigatórios.')
  };
}

module.exports = {
  registerSchema,
  loginSchema
};