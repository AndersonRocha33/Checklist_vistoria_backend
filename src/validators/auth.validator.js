const { requireString } = require('../utils/validators');

function registerSchema(payload) {
  const nome = payload.nome ?? payload.name;
  const email = payload.email;
  const senha = payload.senha ?? payload.password;

  return {
    name: requireString(
      nome,
      'name',
      'Nome, email e senha são obrigatórios.'
    ),
    email: requireString(
      email,
      'email',
      'Nome, email e senha são obrigatórios.'
    ),
    password: requireString(
      senha,
      'password',
      'Nome, email e senha são obrigatórios.'
    ),
  };
}

function loginSchema(payload) {
  const email = payload.email;
  const senha = payload.senha ?? payload.password;

  return {
    email: requireString(
      email,
      'email',
      'Email e senha são obrigatórios.'
    ),
    password: requireString(
      senha,
      'password',
      'Email e senha são obrigatórios.'
    ),
  };
}

module.exports = {
  registerSchema,
  loginSchema,
};