import { Router } from 'express';
import { generateRegistrationCode } from '../controllers/Registration/generateRegistrationCodes.ts';
import { getRegistrationCode } from '../controllers/Registration/getRegistrationCode.ts';
import { makeAnnouncement } from '../controllers/announcement/postAnnouncement.ts';
import { getAnnouncement } from '../controllers/announcement/getAnnouncement.ts';

const router = Router();

router.post('/generate/RegistrationCode', generateRegistrationCode);
router.post('/make-announcement', makeAnnouncement);
router.get('/get-announcement', getAnnouncement);
router.get('/get/RegistrationCode', getRegistrationCode);

export default router;