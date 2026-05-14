const { requireString } = require('../utils/validators');

function forgotPasswordSchema(payload) {
  return {
    email: requireString(payload.email, 'email', 'E-mail é obrigatório.').toLowerCase()
  };
}

function resetPasswordSchema(payload) {
  return {
    token: requireString(payload.token, 'token', 'Token é obrigatório.'),
    password: requireString(payload.password, 'password', 'Nova senha é obrigatória.')
  };
}

module.exports = {
  forgotPasswordSchema,
  resetPasswordSchema
};