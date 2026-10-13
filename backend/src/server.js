require('dotenv').config();
const http         = require('http');
const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const morgan       = require('morgan');
const rateLimit    = require('express-rate-limit');
const { Server }   = require('socket.io');

const { sequelize } = require('./models');
const seed          = require('./seeders/seed');
const { scheduleDailyReset } = require('./services/dailyReset');
const { verifyOnPremiseLicense } = require('./middleware/licenseCheck');

// Import routes
const authRoutes         = require('./routes/auth');
const userRoutes         = require('./routes/users');
const roleRoutes         = require('./routes/roles');
const serviceRoutes      = require('./routes/services');
const counterRoutes      = require('./routes/counters');
const ticketRoutes       = require('./routes/tickets');
const announcementRoutes = require('./routes/announcements');
const reportRoutes       = require('./routes/reports');
const settingRoutes      = require('./routes/settings');
const logRoutes          = require('./routes/logs');
const appointmentRoutes  = require('./routes/appointments');
const departmentRoutes   = require('./routes/departments');
const webhookRoutes      = require('./routes/webhooks');

const app    = express();
const server = http.createServer(app);

// Configure Socket.io
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Attach io to express app so routes can call req.app.get('io')
app.set('io', io);

// Middleware
app.use(helmet({
  contentSecurityPolicy: false // Allow inline scripts and assets for local dev
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Rate Limiting para endpoints públicos (quiosco/búsquedas)
const kioskLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 30, // máximo 30 solicitudes por IP por minuto
  message: { error: 'Demasiadas solicitudes. Por favor espere un momento antes de reintentar.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/tickets/create', kioskLimiter);
app.use('/api/tickets/lookup', kioskLimiter);
app.use('/api/tickets/last-issued', kioskLimiter);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', app: 'Mi turno API', timestamp: new Date() }));
app.get('/api/health', (req, res) => res.json({ status: 'ok', app: 'Mi turno API', timestamp: new Date() }));

// Media Proxy para pantalla TV (Evita bloqueo CSP frame-ancestors / Nextcloud / Google Drive / Intranet)
app.get('/api/media/proxy', async (req, res) => {
  try {
    let targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).json({ error: 'URL requerida' });

    // 1. Transformación automática para Nextcloud / ownCloud share links
    if ((targetUrl.includes('/s/') || targetUrl.includes('/index.php/s/')) && !targetUrl.endsWith('/download') && !targetUrl.endsWith('/preview')) {
      targetUrl = targetUrl.replace(/\/+$/, '') + '/download';
    }

    // 2. Transformación para Dropbox
    if (targetUrl.includes('dropbox.com') && targetUrl.includes('dl=0')) {
      targetUrl = targetUrl.replace('dl=0', 'dl=1');
    }

    // 3. Transformación para Google Drive
    if (targetUrl.includes('drive.google.com')) {
      const match = targetUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || targetUrl.match(/id=([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        targetUrl = `https://drive.google.com/uc?export=download&id=${match[1]}`;
      }
    }

    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Error en servidor de origen: ${response.status}` });
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    // Si la respuesta es una página HTML (como la galería de la intranet)
    if (contentType.includes('text/html')) {
      const htmlText = await response.text();
      // Buscar si contiene enlace directo a .mp4 o <source src="...">
      const mp4Match = htmlText.match(/src=["']([^"']+\.(?:mp4|webm|ogg))["']/i) ||
                       htmlText.match(/["']([^"']+\.mp4(?:\?[^"']*)?)["']/i);

      if (mp4Match && mp4Match[1]) {
        let videoUrl = mp4Match[1];
        if (videoUrl.startsWith('/')) {
          const origin = new URL(targetUrl).origin;
          videoUrl = `${origin}${videoUrl}`;
        } else if (!videoUrl.startsWith('http')) {
          const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
          videoUrl = `${baseUrl}${videoUrl}`;
        }
        return res.redirect(`/api/media/proxy?url=${encodeURIComponent(videoUrl)}`);
      }

      // Si es HTML general, devolverlo con <base href="..."> libre de restricciones de iframe
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      const baseUrl = targetUrl.endsWith('/') ? targetUrl : targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
      const baseTag = `<base href="${baseUrl}">`;
      const modifiedHtml = htmlText.replace('<head>', `<head>${baseTag}`);
      return res.send(modifiedHtml);
    }

    // Si es un flujo binario (imagen PNG, JPG, video MP4)
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');

    const { Readable } = require('stream');
    const nodeStream = Readable.fromWeb(response.body);
    nodeStream.pipe(res);
  } catch (err) {
    console.error('Error en proxy multimedia:', err);
    res.status(500).json({ error: err.message });
  }
});

// Mount routes
app.use('/api/auth',          authRoutes);
app.use('/api/users',         userRoutes);
app.use('/api/roles',         roleRoutes);
app.use('/api/services',      serviceRoutes);
app.use('/api/counters',      counterRoutes);
app.use('/api/tickets',       ticketRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/reports',       reportRoutes);
app.use('/api/settings',      settingRoutes);
app.use('/api/logs',          logRoutes);
app.use('/api/appointments',  appointmentRoutes);
app.use('/api/departments',   departmentRoutes);
app.use('/api/webhooks',      webhookRoutes);

// 404 handler
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint no encontrado' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
  });
});

// Socket.io handlers
io.on('connection', (socket) => {
  console.log(`🔌 Cliente conectado vía WebSocket: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`🔌 Cliente desconectado: ${socket.id}`);
  });

  socket.on('join_display', () => {
    socket.join('display_room');
  });

  socket.on('join_agent', (data) => {
    socket.join(`agent_${data?.agentId || 'all'}`);
  });
});

// Start Server & Sync DB
const PORT = process.env.PORT || process.env.BACKEND_PORT || 3000;

async function ensureDbColumns() {
  try {
    await sequelize.sync();

    // 1. Anuncios
    await sequelize.query(`ALTER TABLE announcements ADD COLUMN IF NOT EXISTS media_url TEXT;`).catch(() => {});
    await sequelize.query(`ALTER TABLE announcements ADD COLUMN IF NOT EXISTS media_type VARCHAR(20) DEFAULT 'image';`).catch(() => {});
    await sequelize.query(`ALTER TABLE announcements ADD COLUMN IF NOT EXISTS duration_seconds INTEGER DEFAULT 15;`).catch(() => {});

    // 2. Servicios
    await sequelize.query(`ALTER TABLE services ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'service';`).catch(() => {});
    await sequelize.query(`UPDATE services SET type = 'service' WHERE type IS NULL;`).catch(() => {});

    // 3. Citas y Departamentos
    await sequelize.query(`ALTER TABLE departments ADD COLUMN IF NOT EXISTS location VARCHAR(120) DEFAULT '';`).catch(() => {});
    await sequelize.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS department_id INTEGER;`).catch(() => {});
    await sequelize.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS client_email VARCHAR(180);`).catch(() => {});
    await sequelize.query(`ALTER TABLE appointments ALTER COLUMN service_id DROP NOT NULL;`).catch(() => {});
    await sequelize.query(`ALTER TABLE appointments ALTER COLUMN status TYPE VARCHAR(30) USING status::VARCHAR;`).catch(() => {});

    // 4. Tickets, Mostradores, Roles y Ajustes
    await sequelize.query(`ALTER TABLE counters ALTER COLUMN status TYPE VARCHAR(30) USING status::VARCHAR;`).catch(() => {});
    await sequelize.query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS client_name VARCHAR(120);`).catch(() => {});
    await sequelize.query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS is_preferential BOOLEAN DEFAULT false;`).catch(() => {});
    await sequelize.query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS preferential_reason VARCHAR(120);`).catch(() => {});
    await sequelize.query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS transferred_from_service_id INTEGER;`).catch(() => {});
    await sequelize.query(`UPDATE roles SET permissions = '["*"]' WHERE LOWER(name) IN ('admin', 'administrador') OR id = 1;`).catch(() => {});
    await sequelize.query(`INSERT INTO settings (key, value, created_at, updated_at) VALUES ('tts_chime_sound', 'custom', NOW(), NOW()) ON CONFLICT (key) DO UPDATE SET value = 'custom';`).catch(() => {});

    console.log('✅ Columnas y esquema de DB auditados y sincronizados correctamente.');
    verifyOnPremiseLicense();
  } catch (err) {
    console.warn('⚠️ Nota sobre verificación de esquema de DB:', err.message);
  }
}

async function start() {
  try {
    await sequelize.authenticate();
    console.log('✅ Conexión a la base de datos PostgreSQL exitosa.');

    if (process.env.SEED_DB === 'true') {
      console.log('🌱 Ejecutando seeder inicial...');
      await seed();
      await ensureDbColumns();
    } else {
      await ensureDbColumns();
      console.log('✅ Tablas sincronizadas.');
    }

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Servidor Mi turno escuchando en http://0.0.0.0:${PORT}`);
      scheduleDailyReset(io);
    });
  } catch (err) {
    console.error('❌ Error al iniciar el servidor:', err);
    process.exit(1);
  }
}

start();

module.exports = { app, server, io };
