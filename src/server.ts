import express, { NextFunction, Request, Response } from 'express';
import patientRoutes from './routes/patient.routes';
import enavRoutes from './routes/enav.routes';
import trackedMedicationRoutes from './routes/trackedmedication.routes';
import medicationRoutes from './routes/medication.routes';
import rewardRoutes from './routes/reward.routes';
import orderingRoutes from './routes/ordering.routes';
import chatRoutes from './routes/chat.routes';
import notificationsRoutes from './routes/notifications.routes';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

/* -------------------------
   Middleware
--------------------------*/
app.set('trust proxy', 1);
app.use(helmet());
app.use(express.json());
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

/* -------------------------
   Rate Limiting
--------------------------*/
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // limit each IP to 500 requests per window
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5, // brute force protection
});
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
});

/* -------------------------
   Health check
--------------------------*/
app.get('/', (req: Request, res: Response) => {
  res.send('TODA MAX Backend is running!');
});

/* -------------------------
   Routes
--------------------------*/
app.use('/enavigator', enavRoutes);
app.use('/patients', patientRoutes);
app.use('/auth', authLimiter, enavRoutes);
app.use('/rewards', rewardRoutes);
app.use('/medications', medicationRoutes);
app.use('/orders', orderingRoutes);
app.use('/trackedmedications', trackedMedicationRoutes);
app.use('/chat', chatLimiter, chatRoutes);
app.use('/notifications', notificationsRoutes);

/* -------------------------
   404 handler
--------------------------*/
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

/* -------------------------
   Global error handler
--------------------------*/
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error & { type?: string }, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Unhandled error]', err);

  // Express throws this when the request body is malformed JSON
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Invalid JSON in request body' });
  }

  res.status(500).json({ success: false, message: 'Internal server error' });
});

/* -------------------------
   Server
--------------------------*/
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 TODA MAX Backend is active!`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`📂 Routes initialized: /enavigator, /patients, /rewards, etc.`);
});

// PREVENT CLEAN EXIT: Keep the process alive
// If the server tries to close unexpectedly, this will help us see why
server.on('close', () => {
  console.log('⚠️ Server connection closed!');
});

server.on('error', (err) => {
  console.error('❌ Server error:', err);
});

// This keeps the Node.js event loop busy so it doesn't "Clean Exit"
setInterval(
  () => {
    // Just a heartbeat to keep the process alive if needed
  },
  1000 * 60 * 60,
);

/* -------------------------
   Uncaught Exception Handler
--------------------------*/
process.on('uncaughtException', (err) => {
  console.error('🔥 There was an uncaught error', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🛠️ Unhandled Rejection at:', promise, 'reason:', reason);
});
