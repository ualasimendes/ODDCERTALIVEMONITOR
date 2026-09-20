import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './backend/api/routes.ts';

// In-memory rate limiting map
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitBuckets.entries()) {
    if (now > val.resetAt) rateLimitBuckets.delete(key);
  }
}, 60000).unref();

function rateLimit(windowMs: number, maxRequests: number, message = 'Muitas requisições. Tente novamente em breve.') {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const rawIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const ip = Array.isArray(rawIp) ? rawIp[0] : String(rawIp).split(',')[0].trim();
    const key = `${ip}:${req.baseUrl || req.path}`;
    const now = Date.now();
    const record = rateLimitBuckets.get(key) || { count: 0, resetAt: now + windowMs };

    if (now > record.resetAt) {
      record.count = 1;
      record.resetAt = now + windowMs;
    } else {
      record.count += 1;
    }
    rateLimitBuckets.set(key, record);

    if (record.count > maxRequests) {
      return res.status(429).json({ success: false, error: message });
    }
    next();
  };
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Security hardening
  app.disable('x-powered-by');

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

  // Limit JSON body size to prevent memory exhaustion
  app.use(express.json({ limit: '100kb' }));

  // Global rate limiter for API endpoints (120 reqs / min)
  app.use('/api', rateLimit(60 * 1000, 120, 'Limite de requisições excedido.'));

  // Mount API routes FIRST
  app.use('/api', apiRouter);

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Vite middleware for development vs static serve for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[OddCerta Live Monitor] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('[OddCerta Live Monitor] Fatal server start error:', err);
});
