import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import cors from 'cors';
import cron from 'node-cron';
import path from 'path';
import authRoutes from './routes/auth';
import sitesRoutes from './routes/sites';
import filtersRoutes from './routes/filters';
import recipientsRoutes from './routes/recipients';
import logsRoutes from './routes/logs';
import { runAllChecks } from './checker';

const app = express();
const PORT = parseInt(process.env.PORT || '3001');
const CHECK_INTERVAL_MINUTES = parseInt(process.env.CHECK_INTERVAL_MINUTES || '180');
const isProd = process.env.NODE_ENV === 'production';

// Railway (and most PaaS) sit behind a reverse proxy — required for secure cookies to work
if (isProd) app.set('trust proxy', 1);

app.use(express.json());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(
  session({
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

// Serve static frontend in production
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

// Schedule checker
const cronExpression = `*/${CHECK_INTERVAL_MINUTES} * * * *`;
// For intervals > 59 minutes, convert to hours
const schedule =
  CHECK_INTERVAL_MINUTES >= 60
    ? `0 */${Math.floor(CHECK_INTERVAL_MINUTES / 60)} * * *`
    : `*/${CHECK_INTERVAL_MINUTES} * * * *`;

cron.schedule(schedule, () => {
  console.log(`[cron] Running scheduled check (every ${CHECK_INTERVAL_MINUTES}m)`);
  runAllChecks().catch(console.error);
});

app.listen(PORT, () => {
  console.log(`Job Watcher server running on port ${PORT}`);
  console.log(`Checks scheduled every ${CHECK_INTERVAL_MINUTES} minutes`);
});

export default app;
