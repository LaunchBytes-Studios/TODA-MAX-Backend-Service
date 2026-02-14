import { Router } from 'express';
import { registerPatient } from '../controllers/patient/registerPatient';
import { loginPatient } from '../controllers/patient/loginPatient';
import { updatePatientProfile } from '../controllers/patient/updatePatient';
import { updatePin } from '../controllers/patient/updatePin';
import multer from 'multer';

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});
const router = Router();

router.post('/register', registerPatient);
router.post('/login', loginPatient);
router.patch('/:id/avatar', upload.single('avatar'), updatePatientProfile);
router.patch('/:id/pin', updatePin);

export default router;
