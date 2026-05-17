const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const fs = require('fs');
const path = require('path');

// Yerel npm start: .env okunur. Docker Compose: DB_HOST/REDIS_HOST container env'den gelir; .env onları ezmez.
const envPath = path.join(__dirname, '..', '.env');
const runningInCompose = process.env.DB_HOST === 'postgres';
const isProduction = process.env.NODE_ENV === 'production';

if (fs.existsSync(envPath)) {
  const parsed = require('dotenv').parse(fs.readFileSync(envPath));
  if (!String(process.env.GEMINI_API_KEY || '').trim() && parsed.GEMINI_API_KEY?.trim()) {
    process.env.GEMINI_API_KEY = parsed.GEMINI_API_KEY.trim();
  }
  if (!runningInCompose && !isProduction) {
    require('dotenv').config({ path: envPath, override: false });
  }
} else {
  require('dotenv').config({ override: false });
}

// Set default environment variables if not provided
process.env.PORT = process.env.PORT || 3000;
process.env.DB_HOST = process.env.DB_HOST || 'localhost';
process.env.DB_PORT = process.env.DB_PORT || 5432;
process.env.DB_NAME = process.env.DB_NAME || 'gym_app_db';
process.env.DB_USER = process.env.DB_USER || 'postgres';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'gym_app_jwt_secret_key_2024_very_secure';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
process.env.REDIS_ENABLED = process.env.REDIS_ENABLED || 'true';
process.env.REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
process.env.REDIS_PORT = process.env.REDIS_PORT || '6379';
process.env.REDIS_CONNECT_TIMEOUT_MS = process.env.REDIS_CONNECT_TIMEOUT_MS || '5000';

const authRoutes = require('./presentation/routes/authRoutes');
const foodRoutes = require('./presentation/routes/foodRoutes');
const aiRoutes = require('./presentation/routes/aiRoutes');
const { errorHandler } = require('./presentation/middleware/errorHandler');
const dbConnection = require('./infrastructure/database/connection');
const redisClient = require('./infrastructure/cache/redisClient');
const trainingProgramRoutes = require('./presentation/routes/trainingProgramRoutes');

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Gym App API',
      version: '1.0.0',
      description: 'Gym App Backend API Documentation',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
      {
        url: 'http://10.152.173.189:3000',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token girin. Önce /api/auth/login endpoint\'inden token alın.'
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: ['./src/presentation/routes/*.js', './src/presentation/controllers/*.js'], // Path to the API files
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
function buildCorsOrigin() {
  if (process.env.CORS_ORIGIN === '*') return true;
  const extra = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const publicUrl = process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL;
  const defaults = [
    'http://localhost:3000',
    'http://localhost:8081',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:8081',
    'http://10.0.2.2:8081',
    'http://10.0.2.2:3000',
    /^http:\/\/192\.168\.\d+\.\d+:\d+$/,
    /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/,
  ];
  if (publicUrl) defaults.push(publicUrl);
  return [...defaults, ...extra];
}

app.use(
  cors({
    origin: buildCorsOrigin(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(morgan('combined'));
// Video base64 (form-score); OOM önlemek için makul limit (15–20 MB video ≈ 20–27 MB)
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/foods', foodRoutes);
app.use('/api/ai', aiRoutes);
app.use("/api/program", trainingProgramRoutes);


// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Gym App Backend is running',
    redis: redisClient.isReady() ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// Database test endpoint
app.get('/api/test-db', async (req, res) => {
  try {
    const dbConnection = require('./infrastructure/database/connection');
    const db = dbConnection.connect();
    const result = await db.query('SELECT NOW() as current_time');
    res.status(200).json({
      success: true,
      message: 'Database connection successful',
      data: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: error.message
    });
  }
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// Start server
const startServer = async () => {
  try {
    // Initialize database connection
    console.log('🔌 Connecting to database...');
    await dbConnection.connect();
    console.log('✅ Database connected successfully');

    try {
      await redisClient.connect();
      console.log('✅ Redis connected successfully');
    } catch (redisError) {
      console.warn('⚠️ Redis connection failed, continuing without cache:', redisError.message);
    }
    
    // Start server
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`📱 Health check: http://localhost:${PORT}/health`);
      console.log(`📱 Swagger UI: http://localhost:${PORT}/api-docs`);
      console.log(`📱 Network access: http://0.0.0.0:${PORT}/health`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

process.on('SIGINT', async () => {
  await redisClient.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await redisClient.disconnect();
  process.exit(0);
});

module.exports = app;
