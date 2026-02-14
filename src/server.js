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
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
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
  // eslint-disable-next-line no-console
  const displayHost = env.HOST === '0.0.0.0' ? 'localhost' : env.HOST;
  // eslint-disable-next-line no-console
  console.info(`API listening on http://${displayHost}:${env.PORT}`);
});

// Increase timeout for bulk file uploads (default is 120s)
// Match with Vite proxy timeout (5 minutes)
server.timeout = 5 * 60 * 1000; // 5 minutes
server.keepAliveTimeout = 5 * 60 * 1000 + 1000; // Slightly longer than timeout
server.headersTimeout = 5 * 60 * 1000 + 2000; // Slightly longer than keepAliveTimeout

server.on('error', (err) => {
  if (err?.code === 'EADDRINUSE') {
    // eslint-disable-next-line no-console
    console.error(`\n⚠️  Port ${env.PORT} sudah dipakai oleh aplikasi lain!`);
    console.error(`Solusi:`);
    console.error(`  1. Stop proses yang pakai port ${env.PORT}: netstat -ano | findstr :${env.PORT}`);
    console.error(`  2. Atau ganti PORT di file .env ke port lain (misal: 3500, 3600, 8000)\n`);
    process.exit(1);
  }

  // eslint-disable-next-line no-console
  console.error('Failed to start server:', err);
  process.exit(1);
});

const gracefulShutdown = () => {
  // eslint-disable-next-line no-console
  console.info('Received kill signal, shutting down gracefully');
  server.close(() => {
    // eslint-disable-next-line no-console
    console.info('Closed out remaining connections');
    process.exit(0);
  });

  setTimeout(() => {
    // eslint-disable-next-line no-console
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Handle nodemon restart signal
process.on('SIGUSR2', () => {
  console.info('Received SIGUSR2 (nodemon restart), closing server');
  server.close(() => {
    console.info('Server closed');
    process.kill(process.pid, 'SIGUSR2');
  });
});
