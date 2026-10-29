const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();
console.log("SERVER DB ENV:", { DB_USER: process.env.DB_USER, DB_DATABASE: process.env.DB_DATABASE, DB_PORT: process.env.DB_PORT });

const pool = require('./config/db');
const { initDB } = require('./config/initDb');
const { setupMailer } = require('./config/mailer');
const { setupWhatsAppQueue } = require('./config/whatsappQueue');

const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const facultyRoutes = require('./routes/facultyRoutes');
const adminRoutes = require('./routes/adminRoutes');
const ltcRoutes = require('./routes/ltcRoutes');
const userRoutes = require('./routes/userRoutes');
const generalRoutes = require('./routes/generalRoutes');
const superadminRoutes = require('./routes/superadminRoutes');
const riRoutes = require('./routes/riRoutes');
const riFacultyRoutes = require('./routes/riFacultyRoutes');
const riStudentRoutes = require('./routes/riStudentRoutes');
const riSuperAdminRoutes = require('./routes/riSuperAdminRoutes');
const riNodalOfficerRoutes = require('./routes/riNodalOfficerRoutes');
const riSupportRoutes = require('./routes/riSupportRoutes');
const riRedFlagRoutes = require('./routes/riRedFlagRoutes');
const riOrangeFlagRoutes = require('./routes/riOrangeFlagRoutes');
const ltcReportRoutes = require('./routes/ltcReportRoutes');

const app = express();

// Trust reverse proxy for client IP forwarding headers (e.g. X-Forwarded-For)
app.set('trust proxy', 1);

const allowedOrigins = [
  "http://13.207.119.57",
  "https://13.207.119.57",
  "http://13.207.119.57:5173",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5180",
  "http://localhost:3000",
  process.env.FRONTEND_URL
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    // Allow non-browser requests (e.g. mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    
    // Check against configured allowed origins
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // In non-production environments, permit local development ports
    if (process.env.NODE_ENV !== 'production') {
      if (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")) {
        return callback(null, true);
      }
    }
    
    // In production, reject unverified external origins
    if (process.env.NODE_ENV === 'production') {
      return callback(new Error(`CORS origin not allowed: ${origin}`));
    }

    return callback(null, true);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
    "Cache-Control",
    "Pragma",
    "X-Client-Date",
    "x-delete-otp",
    "X-Delete-Otp",
    "x-is-editing-response",
    "X-Is-Editing-Response",
    "x-update-response",
    "X-Update-Response",
    "x-student-id",
    "X-Student-Id",
    "x-selected-student-id",
    "X-Selected-Student-Id",
    "x-batch-photos-count",
    "X-Batch-Photos-Count"
  ]
};

// Apply CORS before security headers & routes
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// ─── HTTP Security Headers ───────────────────────────────────────────────────
const bucketName = process.env.AWS_BUCKET_NAME || 'life-awakening-media-2026';
const awsRegion = process.env.AWS_REGION || 'ap-south-1';
const s3BucketDomain = `https://${bucketName}.s3.${awsRegion}.amazonaws.com`;
const s3BucketGlobalDomain = `https://${bucketName}.s3.amazonaws.com`;
const s3RegionWildcard = `https://*.s3.${awsRegion}.amazonaws.com`;
const s3GlobalWildcard = `https://*.s3.amazonaws.com`;

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://cdn.tailwindcss.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "blob:", "https:", s3BucketDomain, s3BucketGlobalDomain, s3RegionWildcard, s3GlobalWildcard],
        mediaSrc: ["'self'", "data:", "blob:", "https:", s3BucketDomain, s3BucketGlobalDomain, s3RegionWildcard, s3GlobalWildcard],
        connectSrc: ["'self'", s3BucketDomain, s3BucketGlobalDomain, s3RegionWildcard, s3GlobalWildcard, "http://localhost:*", "ws://localhost:*", "wss://localhost:*", "http://127.0.0.1:*"],
        frameSrc: ["'self'", "https://docs.google.com"],
        childSrc: ["'self'", "blob:"],
        workerSrc: ["'self'", "blob:"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'", "https://docs.google.com"],
        upgradeInsecureRequests: null,
      },
    },
    strictTransportSecurity: {
      maxAge: 31536000,
      includeSubDomains: true,
    },
    frameguard: { action: "sameorigin" },
    noSniff: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// ── Permissions-Policy header ─────────────────────────────────────────────────
app.use((_req, res, next) => {
  res.setHeader(
    "Permissions-Policy",
    [
      "camera=()",
      "microphone=()",
      "geolocation=()",
      "usb=()",
      "payment=()",
      "accelerometer=()",
      "gyroscope=()",
      "magnetometer=()",
    ].join(", ")
  );
  next();
});



// Global parsing limits (specific bulk-upload routes override these at the router level)
app.use(express.json({ limit: '700mb' }));
app.use(express.urlencoded({ limit: '700mb', extended: true }));

const path = require('path');
const uploadsStaticDir = path.join(__dirname, 'uploads');
const serveUploadsStatic = express.static(uploadsStaticDir, {
  maxAge: '1d',
  setHeaders: (res) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
});

const uploadsMiddleware = (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self' data: blob: https:; media-src 'self' data: blob: https:;");
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
};

// Mount both routes so CloudFront /api/uploads and direct /uploads both work seamlessly
app.use('/api/uploads', uploadsMiddleware, serveUploadsStatic);
app.use('/uploads', uploadsMiddleware, serveUploadsStatic);

const generalController = require('./controllers/generalController');
app.get('/api/media/file', generalController.serveMediaFile);

const { handleResendWebhook } = require('./controllers/webhookController');
app.post('/api/webhooks/resend', handleResendWebhook);

// Health check endpoint for monitoring, deployment verification, and load balancers
app.get(['/api/health', '/health'], (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'life-awakening-api',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// Mount MVC routers
app.use('/api', authRoutes); // /api/login
app.use('/api/student', studentRoutes);
app.use('/api/faculty', facultyRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ltc', ltcRoutes);
app.use('/api/users', userRoutes);
app.use('/api', generalRoutes); // /api/verify, /api/documents, etc.
app.use('/api/superadmin', superadminRoutes);
app.use('/api/ri/faculty-portal', riFacultyRoutes);
app.use('/api/ri/faculty', riFacultyRoutes);
app.use('/api/ri/student', riStudentRoutes);
app.use('/api/ri/superadmin', riSuperAdminRoutes);
app.use('/api/ri-superadmin', riSuperAdminRoutes);
app.use('/api/ri-nodal', riNodalOfficerRoutes);
app.use('/api/ri/support', riSupportRoutes);
app.use('/api/ri/tickets', riSupportRoutes);
app.use('/api/ri/red-flags', riRedFlagRoutes);
app.use('/api/ri/redflags', riRedFlagRoutes);
app.use('/api/ri/orange-flags', riOrangeFlagRoutes);
app.use('/api/ri', riRoutes);
app.use('/api/ltc-report', ltcReportRoutes);


const storageService = require('./services/storageService');

const PORT = process.env.PORT || 5001;

// Helper to free port if an orphaned node process is holding it
const { execSync } = require('child_process');
const freePortIfOccupied = (port) => {
  try {
    if (process.platform === 'win32') {
      const stdout = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
      const lines = stdout.trim().split('\n');
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 5 && parts[1].endsWith(`:${port}`) && parts[3] === 'LISTENING') {
          const pid = parts[4];
          if (pid && pid !== '0' && pid !== `${process.pid}`) {
            console.log(`[Port Recovery] Port ${port} is occupied by PID ${pid}. Terminating orphaned process...`);
            try {
              execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
            } catch (_) { }
          }
        }
      }
    } else {
      try {
        execSync(`fuser -k ${port}/tcp`, { stdio: 'ignore' });
      } catch (_) { }
    }
  } catch (_) {
    // Port was free
  }
};

let currentServer = null;

// Setup database & mailer, then start listening
const startServer = async () => {
  await initDB(pool);
  await setupMailer();
  await setupWhatsAppQueue();

  const listen = (retries = 2) => {
    const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`[Port ${PORT} in use] Attempting to free port and retry... (${retries} retries left)`);
        freePortIfOccupied(PORT);
        if (retries > 0) {
          setTimeout(() => {
            listen(retries - 1);
          }, 1000);
        } else {
          console.error(`Failed to bind port ${PORT}: Address still in use.`);
          process.exit(1);
        }
      } else {
        console.error("Server error:", err);
        process.exit(1);
      }
    });

    currentServer = server;
  };

  listen();
};

const handleShutdown = () => {
  console.log('Shutting down server gracefully...');
  if (currentServer) {
    currentServer.close(() => {
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
  setTimeout(() => process.exit(0), 2000);
};

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);
process.on('SIGUSR2', handleShutdown);

startServer().catch(err => {
  console.error("Failed to start server:", err);
  process.exit(1);
});


