// server.ts
import express, { Request, Response } from 'express';
import patientRoutes from './routes/patient.routes';
import enavRoutes from './routes/enav.routes';
import medicationRoutes from './routes/medication.routes'; // NEW
import cors from 'cors';

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
app.use('/medications', medicationRoutes); // NEW

/* -------------------------
   Server
--------------------------*/
app.listen(PORT, '0.0.0.0', () => console.log(`Server is running on http://localhost:${PORT}`));
