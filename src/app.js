const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth.routes');
const enterpriseRoutes = require('./routes/enterprise.routes');
const apartmentRoutes = require('./routes/apartment.routes');
const inspectionRoutes = require('./routes/inspection.routes');
const uploadRoutes = require('./routes/upload.routes');

const app = express();

const allowedOrigins = [
  process.env.APP_URL,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174'
].filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      if (origin.endsWith('.vercel.app')) {
        return callback(null, true);
      }

      console.error('Origem bloqueada pelo CORS:', origin);
      return callback(new Error('Origem não permitida pelo CORS.'));
    },
    credentials: true
  })
);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

app.get('/health', (req, res) => {
  return res.json({ message: 'API online' });
});

app.use('/auth', authRoutes);
app.use('/enterprises', enterpriseRoutes);
app.use('/apartments', apartmentRoutes);
app.use('/inspections', inspectionRoutes);
app.use('/upload', uploadRoutes);

module.exports = app;