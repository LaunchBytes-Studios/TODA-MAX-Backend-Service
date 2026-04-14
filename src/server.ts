import express, { NextFunction, Request, Response } from 'express';
import patientRoutes from './routes/patient.routes';
import enavRoutes from './routes/enav.routes';
import trackedMedicationRoutes from './routes/trackedmedication.routes';
import medicationRoutes from './routes/medication.routes';
import rewardRoutes from './routes/reward.routes';
import orderingRoutes from './routes/ordering.routes';
import cors from 'cors';
import chatRoutes from './routes/chat.routes';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

/* -------------------------
   Middleware
--------------------------*/
app.use(express.json());
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

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
app.use('/auth', enavRoutes);
app.use('/rewards', rewardRoutes);
app.use('/medications', medicationRoutes);
app.use('/orders', orderingRoutes);
app.use('/trackedmedications', trackedMedicationRoutes);
app.use('/chat', chatRoutes);

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
app.listen(PORT, '0.0.0.0', () => console.log(`Server is running on http://localhost:${PORT}`));
