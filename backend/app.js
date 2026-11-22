const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { createApiRouter } = require('./routes');

function buildCorsOptions() {
  const raw = process.env.CORS_ORIGIN;
  if (!raw || raw.trim() === '*') {
    return { origin: true, credentials: true };
  }
  const allowlist = raw.split(',').map(item => item.trim()).filter(Boolean);
  return {
    origin(origin, callback) {
      // Allow non-browser clients (Android app, curl, Postman) with no Origin header
      if (!origin || allowlist.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true
  };
}

function createApp() {
  const app = express();

  app.use(cors(buildCorsOptions()));
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  if (process.env.NODE_ENV !== 'test') {
    app.use((req, _res, next) => {
      console.log(`➡️  ${req.method} ${req.originalUrl} từ ${req.ip}`);
      next();
    });
  }

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
  }

  // Centralized error fallback (e.g. CORS rejection or malformed JSON)
  app.use((err, _req, res, _next) => {
    const status = err.status || (err.message && err.message.startsWith('CORS blocked') ? 403 : 500);
    return res.status(status).json({ error: err.message || 'Internal Server Error' });
  });

  return app;
}

module.exports = { createApp };
