import { Router } from 'express';
import { login, me } from '../controllers/enavigator/loginEnav';
import { authenticate } from '../middleware/enav.middleware';

import { generateRegistrationCode } from '../controllers/Registration/generateRegistrationCodes.ts';
import { getRegistrationCode } from '../controllers/Registration/getRegistrationCode.ts';
import { makeAnnouncement } from '../controllers/announcement/postAnnouncement.ts';
import { getAnnouncement } from '../controllers/announcement/getAnnouncement.ts';

const router = Router();

router.post('/login', login);
router.get('/me', authenticate, me);




router.post('/RegistrationCode', generateRegistrationCode);
router.post('/generate/RegistrationCode', generateRegistrationCode);
router.post('/make-announcement', makeAnnouncement);
router.get('/get-announcement', getAnnouncement);
router.get('/get/RegistrationCode', getRegistrationCode);

export default router;