import { Router } from 'express';
import { registerPatient } from '../controllers/patient/registerPatient';
import { loginPatient } from '../controllers/patient/loginPatient';
import { updatePatientProfile } from '../controllers/patient/updatePatientProfile';
import { updateAvatar } from '../controllers/patient/updateAvatar';
import { updatePin } from '../controllers/patient/updatePin';
import { authenticatePatient } from '../middleware/auth';
import multer from 'multer';

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

const router = Router();

router.post('/register', registerPatient);
router.post('/login', loginPatient);

router.patch('/:id/profile', authenticatePatient, updatePatientProfile);
router.patch('/:id/avatar', authenticatePatient, upload.single('avatar'), updateAvatar);
router.patch('/:id/pin', authenticatePatient, updatePin);

export default router;
