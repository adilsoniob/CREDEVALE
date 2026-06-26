require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { initDatabase } = require('./src/database');

const authRoutes = require('./src/routes/auth');
const clientRoutes = require('./src/routes/clients');
const productRoutes = require('./src/routes/products');
const requestRoutes = require('./src/routes/requests');
const paymentRoutes = require('./src/routes/payments');
const adminRoutes = require('./src/routes/admin');
const webhookRoutes = require('./src/routes/webhooks');
const cpfRoutes = require('./src/routes/cpf');
const trackRoutes = require('./src/routes/track');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy (Railway, ELB, etc.)
app.set('trust proxy', 1);

// Security
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files (frontend)
app.use(express.static(path.join(__dirname, '..'), { maxAge: '1h' }));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/products', productRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/track', trackRoutes);
app.use('/api/cpf', cpfRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// SPA fallback for frontend pages
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'admin.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({
    error: err.message || 'Erro interno do servidor'
  });
});

// Initialize database and start
initDatabase();

app.listen(PORT, () => {
  console.log(`[VALE SAUDE] Backend rodando na porta ${PORT}`);
  console.log(`[VALE SAUDE] http://localhost:${PORT}`);
});

module.exports = app;
