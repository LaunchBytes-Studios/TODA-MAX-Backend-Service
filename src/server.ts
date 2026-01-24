import express, { Request, Response } from 'express';
import patientRoutes from './routes/patient.routes.ts';
import eNavigatorRoutes from './routes/eNavigator.routes.ts';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

/* -------------------------
   Middleware
--------------------------*/
app.use(express.json()); // REQUIRED
app.use(cors());

/* -------------------------
   Health check
--------------------------*/
app.get('/', (req: Request, res: Response) => {
  res.send('TODA MAX Backend is running!');
});

/* -------------------------
   Routes
--------------------------*/
app.use('/enavigator', eNavigatorRoutes);
app.use('/patients', patientRoutes);

/*
  This creates:
  POST /patients/register
*/

/* -------------------------
   Server
--------------------------*/
// app.listen(PORT, () => {
//   console.log(`Server is running on http://localhost:${PORT}`);
// });
app.listen(3000, '0.0.0.0', () => console.log(`Server is running on http://localhost:${PORT}`));
