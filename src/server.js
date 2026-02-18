import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pino from 'pino-http';
import { createExpressMiddleware } from '@trpc/server/adapters/express';

import { env, corsOrigins } from './config/env.js';
import { notFound, errorHandler } from './lib/errors.js';
import apiRoutes from './routes/index.js';
import { appRouter, createContext } from '@genbi/trpc';
import { initTempStorage } from './storage/temp-storage.js';

initTempStorage();

const app = express();

app.disable('x-powered-by');

app.use(
  pino({
    autoLogging: true,
    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie'],
      remove: true,
    },
  }),
);

app.use(
  helmet({
    crossOriginOpenerPolicy: { policy: 'unsafe-none' },
    crossOriginEmbedderPolicy: false,
  }),
);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

const origins = corsOrigins();
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (origins.includes(origin)) return cb(null, true);
      const err = new Error(`CORS blocked for origin: ${origin}`);

      err.statusCode = 403;
      return cb(err);
    },
    credentials: true,
  }),
);

app.get('/api/v1/health', (_req, res) => {
  res.json({ ok: true, name: 'genbi-server', env: env.NODE_ENV });
});

app.use(
  '/api/trpc',
  createExpressMiddleware({
    router: appRouter,
    createContext,
  }),
);

app.use('/api/v1', apiRoutes);

app.use(notFound);
app.use(errorHandler);

const server = app.listen(env.PORT, env.HOST, () => {
  // Server is up
});

// Increase timeout for bulk file uploads (default is 120s)
// Match with Vite proxy timeout (5 minutes)
server.timeout = 5 * 60 * 1000; // 5 minutes
server.keepAliveTimeout = 5 * 60 * 1000 + 1000; // Slightly longer than timeout
server.headersTimeout = 5 * 60 * 1000 + 2000; // Slightly longer than keepAliveTimeout

server.on('error', (err) => {
  if (err?.code === 'EADDRINUSE') {
    process.exit(1);
  }
  process.exit(1);
});

const gracefulShutdown = () => {
  server.close(() => {
    process.exit(0);
  });

  setTimeout(() => {
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Handle nodemon restart signal
process.on('SIGUSR2', () => {
  server.close(() => {
    process.kill(process.pid, 'SIGUSR2');
  });
});
