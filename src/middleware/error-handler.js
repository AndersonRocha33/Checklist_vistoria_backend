function errorHandler(error, req, res, next) {
  console.error('=== ERRO INTERNO ===');
  console.error('Rota:', req.method, req.originalUrl);
  console.error('Authorization:', req.headers.authorization);
  console.error('Params:', req.params);
  console.error('Query:', req.query);
  console.error('Body:', req.body);
  console.error('Mensagem:', error.message);
  console.error('Stack:', error.stack);

  const statusCode = error.statusCode || 500;

  return res.status(statusCode).json({
    message: statusCode === 500 ? 'Erro interno do servidor.' : error.message,
  });
}

module.exports = errorHandler;