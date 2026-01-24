import { Router } from 'express';
import { registerPatient } from '../controllers/registerPatient.ts';

const router = Router();

router.post('/register', registerPatient);

export default router;
