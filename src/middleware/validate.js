const { ValidationError } = require('../errors/http-errors');

function validate(schema, target = 'body') {
  return (req, res, next) => {
    try {
      const parsed = schema(req[target] || {});
      req.validated = req.validated || {};
      req.validated[target] = parsed;
      return next();
    } catch (error) {
      return next(
        new ValidationError(error.message || 'Dados de entrada inválidos.', error.details || null)
      );
    }
  };
}

module.exports = validate;
