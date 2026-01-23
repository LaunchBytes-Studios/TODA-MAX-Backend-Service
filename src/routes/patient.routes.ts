import { Router } from 'express';
import { registerPatient } from '../controllers/patient/registerPatient';
import { loginPatient } from '../controllers/patient/loginPatient';

const router = Router();

router.post('/register', registerPatient);
router.post('/login', loginPatient);

export default router;
