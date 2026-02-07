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
    // Google Identity Services uses a popup + postMessage flow.
    // Helmet defaults to COOP: same-origin which breaks this in modern browsers.
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    // COEP can also cause issues with third-party auth flows; keep it off unless needed.
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
      if (!origin) return cb(null, true); // allow non-browser tools
      if (origins.length === 0) return cb(null, true); // default allow all in dev until configured
      if (origins.includes(origin)) return cb(null, true);
      const err = new Error(`CORS blocked for origin: ${origin}`);
      // Ensure this is treated as a client/configuration issue (not an internal server error)
      // by downstream error handling.
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

app.listen(env.PORT, env.HOST, () => {
  // eslint-disable-next-line no-console
  const displayHost = env.HOST === '0.0.0.0' ? 'localhost' : env.HOST;
  console.log(`API listening on http://${displayHost}:${env.PORT}`);
});
