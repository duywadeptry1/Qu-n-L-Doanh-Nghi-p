const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { createApiRouter } = require('./routes');
const { connectToDatabase } = require('./services/db');

function normalizeOrigin(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function buildCorsDelegate() {
  const raw = process.env.CORS_ORIGIN;
  const allowAll = !raw || raw.trim() === '*';
  const allowlist = new Set(
    (raw || '')
      .split(',')
      .map(normalizeOrigin)
      .filter(Boolean)
  );

  const renderUrl = normalizeOrigin(process.env.RENDER_EXTERNAL_URL);
  if (renderUrl) {
    allowlist.add(renderUrl);
  }

  return (req, callback) => {
    const requestOrigin = normalizeOrigin(req.header('Origin'));

    // Allow non-browser clients (Android app, curl, Postman) or wildcard mode
    if (!requestOrigin || allowAll) {
      return callback(null, { origin: true, credentials: true });
    }

    // Always allow same-origin requests (e.g. Web Portal hosted by this same Express server)
    const host = req.get('host');
    const forwardedProto = String(req.header('x-forwarded-proto') || req.protocol || 'https')
      .split(',')[0]
      .trim();
    const sameOriginHttps = host ? `https://${host}` : '';
    const sameOriginProto = host ? `${forwardedProto}://${host}` : '';

    if (
      requestOrigin === sameOriginHttps ||
      requestOrigin === sameOriginProto ||
      allowlist.has(requestOrigin)
    ) {
      return callback(null, { origin: true, credentials: true });
    }

    return callback(new Error(`CORS blocked for origin: ${requestOrigin}`));
  };
}

function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(cors(buildCorsDelegate()));
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  // Ignore noisy browser favicon probes without touching MongoDB
  app.get(['/favicon.ico', '/favicon.png'], (_req, res) => res.status(204).end());

  if (process.env.NODE_ENV !== 'test') {
    app.use((req, _res, next) => {
      console.log(`➡️  ${req.method} ${req.originalUrl} từ ${req.ip}`);
      next();
    });
  }

  // Ensure MongoDB connection on serverless runtimes (Vercel) before API routes execute
  app.use('/api', async (_req, res, next) => {
    if (process.env.NODE_ENV === 'test') return next();
    try {
      await connectToDatabase();
      return next();
    } catch (err) {
      console.error('❌ Serverless DB Error:', err.message);
      return res.status(500).json({ error: 'Lỗi kết nối cơ sở dữ liệu' });
    }
  });

  // Transition-compatible API for existing Android app + JWT-aware clients
  app.use('/api', createApiRouter({ strictAuth: false }));

  // Strict JWT + RBAC API namespace for Web Portal (and future Android auth)
  app.use('/api/v1', createApiRouter({ strictAuth: true }));

  // Clean JSON 404 for unknown API endpoints
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint không tồn tại' });
  });

  // Optional single-server hosting for built Web Portal (portal/dist)
  const portalDistDir = path.resolve(__dirname, '../portal/dist');
  const portalIndexPath = path.join(portalDistDir, 'index.html');
  if (process.env.SERVE_PORTAL !== 'false' && fs.existsSync(portalIndexPath)) {
    app.use(express.static(portalDistDir));
    app.get('*', (_req, res) => {
      res.sendFile(portalIndexPath);
    });
  } else {
    app.get('/', (_req, res) => {
      res.json({
        status: 'OK',
        service: 'Viễn Đông Sales API Server',
        health: '/api/health',
        portalApi: '/api/v1'
      });
    });
  }

  // Centralized error fallback (e.g. CORS rejection or malformed JSON)
  app.use((err, _req, res, _next) => {
    const status = err.status || (err.message && err.message.startsWith('CORS blocked') ? 403 : 500);
    return res.status(status).json({ error: err.message || 'Internal Server Error' });
  });

  return app;
}

// Export an Express app directly for Vercel's Express runtime while preserving `const { createApp } = require('./app')`
const defaultApp = createApp();
defaultApp.createApp = createApp;

module.exports = defaultApp;
