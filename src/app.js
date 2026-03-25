const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth.routes');
const enterpriseRoutes = require('./routes/enterprise.routes');
const apartmentRoutes = require('./routes/apartment.routes');
const inspectionRoutes = require('./routes/inspection.routes');
const uploadRoutes = require('./routes/upload.routes');
const errorHandler = require('./middleware/error-handler');

const app = express();

app.use(
  cors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
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

app.use(errorHandler);

module.exports = app;
