import { Router } from 'express';
import { generateRegistrationCode } from '../controllers/registration/generateRegistrationCodes.ts';
import { getRegistrationCode } from '../controllers/registration/getRegistrationCode.ts';
import { makeAnnouncement } from '../controllers/announcement/postAnnouncement.ts';
import { getAnnouncement } from '../controllers/announcement/getAnnouncement.ts';
import { deleteRegistrationCode } from '../controllers/registration/deleteRegistrationCode.ts';

const router = Router();

router.delete('/delete/RegistrationCode', deleteRegistrationCode);
router.post('/generate/RegistrationCode', generateRegistrationCode);
router.post('/post/Announcement', makeAnnouncement);
router.get('/get/Announcement', getAnnouncement);
router.get('/get/RegistrationCode', getRegistrationCode);

export default router;