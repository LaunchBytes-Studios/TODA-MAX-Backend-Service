import { Router } from 'express';
import { login, me } from '../controllers/enavigator/loginEnav';
import { authenticate } from '../middleware/enav.middleware';

import { generateRegistrationCode } from '../controllers/Registration/generateRegistrationCodes.ts';
import { getRegistrationCode } from '../controllers/Registration/getRegistrationCode.ts';
import { makeAnnouncement } from '../controllers/announcement/postAnnouncement.ts';
import { getAnnouncement } from '../controllers/announcement/getAnnouncement.ts';
import { alertMedication } from '../controllers/Medication/alertMedication.ts';

const router = Router();

//eNav auth routes
router.post('/login', login);
router.get('/me', authenticate, me);


//eNav utitlity routes
router.post('/RegistrationCode', authenticate, generateRegistrationCode);
router.post('/generate/RegistrationCode', authenticate, generateRegistrationCode);
router.post('/post/Announcement', authenticate, makeAnnouncement);
router.get('/get/Announcement', authenticate, getAnnouncement);
router.get('/get/RegistrationCode', authenticate, getRegistrationCode);
router.get('/alert/Medication', authenticate, alertMedication);

export default router;