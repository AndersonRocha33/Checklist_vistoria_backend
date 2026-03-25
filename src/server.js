const app = require('./app');
const tokenService = require('./services/token.service');

const PORT = process.env.PORT || 4000;

tokenService.getSecret();

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
