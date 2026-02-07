import { Router } from 'express';
import { login, me } from '../controllers/enavigator/loginEnav';
import { authenticate } from '../middleware/enav.middleware';

import { generateRegistrationCode } from '../controllers/registration/generateRegistrationCodes.controller.ts';
import { getRegistrationCode } from '../controllers/registration/getRegistrationCode.controller.ts';
import { maintenanceRegistrationCode } from '../controllers/registration/maintenanceRegistration.controller.ts';
import { makeAnnouncement } from '../controllers/announcement/postAnnouncement.controller.ts';
import { getAnnouncement } from '../controllers/announcement/getAnnouncement.controller.ts';
import { alertMedication } from '../controllers/medication/alertMedication.controller.ts';

const router = Router();

//eNav auth routes
router.post('/login', login);
router.get('/me', authenticate, me);

//eNav utitlity routes
router.post('/registrationCode', authenticate, generateRegistrationCode);
router.post('/generate/registrationCode', authenticate, generateRegistrationCode);
router.post('/post/announcement', authenticate, makeAnnouncement);
router.get('/get/announcement', authenticate, getAnnouncement);
router.get('/get/registrationCode', authenticate, getRegistrationCode);
router.get('/alert/medication', authenticate, alertMedication);

export default router;
