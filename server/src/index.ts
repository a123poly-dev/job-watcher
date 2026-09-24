import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import FileStore from 'session-file-store';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import authRoutes from './routes/auth';
import sitesRoutes from './routes/sites';
import filtersRoutes from './routes/filters';
import recipientsRoutes from './routes/recipients';
import logsRoutes from './routes/logs';
import cronRoutes from './routes/cron';

const app = express();
const PORT = parseInt(process.env.PORT || '3001');
const isProd = process.env.NODE_ENV === 'production';

// Railway sits behind a reverse proxy — required for secure cookies to work
if (isProd) app.set('trust proxy', 1);

// Session file store — persists across restarts and multiple instances
const SessionFileStore = FileStore(session);
const sessionDir = process.env.SESSION_DIR || path.join(__dirname, '../../sessions');
if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

app.use(express.json());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(
  session({
    store: new SessionFileStore({ path: sessionDir, retries: 1, logFn: () => {} }),
    secret: process.env.SESSION_SECRET || 'job-watcher-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProd,
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if ((req.session as any).authenticated) return next();
  res.status(401).json({ error: 'Unauthorized' });
};

app.use('/api/auth', authRoutes);
app.use('/api/sites', requireAuth, sitesRoutes);
app.use('/api/filters', requireAuth, filtersRoutes);
app.use('/api/recipients', requireAuth, recipientsRoutes);
app.use('/api/logs', requireAuth, logsRoutes);
app.use('/api/cron', cronRoutes);

// Serve static frontend in production
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`Job Watcher server running on port ${PORT}`);
});

export default app;
