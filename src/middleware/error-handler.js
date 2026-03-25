const AppError = require('../errors/app-error');

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      message: error.message,
      code: error.code,
      details: error.details || undefined
    });
  }

  if (error?.code === 'P2002') {
    return res.status(409).json({
      message: 'Conflito de dados.',
      code: 'CONFLICT'
    });
  }

  if (error?.code === 'P2025') {
    return res.status(404).json({
      message: 'Recurso não encontrado.',
      code: 'NOT_FOUND'
    });
  }

  console.error(error);

  return res.status(500).json({
    message: 'Erro interno do servidor.',
    code: 'INTERNAL_ERROR'
  });
}

module.exports = errorHandler;
