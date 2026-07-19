process.env.TZ = 'America/Sao_Paulo';
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
const clientAreaRoutes = require('./src/routes/client-area');
const webhookRoutes = require('./src/routes/webhooks');
const cpfRoutes = require('./src/routes/cpf');
const trackRoutes = require('./src/routes/track');
const appRoutes = require('./src/routes/app');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy (Railway, ELB, etc.)
app.set('trust proxy', 1);

// Security
app.use(helmet({ contentSecurityPolicy: false }));
const allowedOrigins = (process.env.CORS_ORIGIN || '*').split(',').map(s => s.trim());
app.use(cors({
  origin: function (origin, cb) {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) cb(null, true);
    else cb(null, false);
  },
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files (frontend) — built assets first (dist), then root fallback
app.use(express.static(path.join(__dirname, '..', 'dist'), { maxAge: '1y', etag: true, lastModified: true }));
app.use(express.static(path.join(__dirname, '..'), { maxAge: '1h', etag: true, lastModified: true }));
// Uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), { maxAge: '1h' }));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/products', productRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/client-area', clientAreaRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/track', trackRoutes);
app.use('/api/cpf', cpfRoutes);
app.use('/api/app', appRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// SPA fallback for frontend pages
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'admin.html'));
});
app.get('/cliente', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'cliente.html'));
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
  console.log(`[VALE SAUDE] SMS routes mounted at /api/admin/sms`);
});

module.exports = app;
