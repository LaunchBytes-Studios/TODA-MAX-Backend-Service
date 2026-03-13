import { Router } from 'express';
import { login, me } from '../controllers/enavigator/loginEnav';
import { authenticate } from '../middleware/enav.middleware';

import { generateRegistrationCode } from '../controllers/registration/generateRegistrationCodes.controller.ts';
import { getRegistrationCode } from '../controllers/registration/getRegistrationCode.controller.ts';
import { maintenanceRegistrationCode } from '../controllers/registration/maintenanceRegistration.controller.ts';
import { makeAnnouncement } from '../controllers/announcement/postAnnouncement.controller.ts';
import { getAnnouncement } from '../controllers/announcement/getAnnouncement.controller.ts';
import { alertMedication } from '../controllers/medication/alertMedication.controller.ts';
import { getOrders, updateOrderStatus } from '../controllers/enav-orders/order.controller.ts';

const router = Router();

//eNav auth routes
router.post('/login', login);
router.get('/me', authenticate, me);

//eNav utility routes - Registration Codes
router.post('/registrationCodes/generate', authenticate, generateRegistrationCode);
router.get('/registrationCodes', authenticate, getRegistrationCode);
router.post('/registrationCodes/maintenance', authenticate, maintenanceRegistrationCode);

//eNav utility routes - Announcements
router.post('/announcements', authenticate, makeAnnouncement);
router.get('/announcements', authenticate, getAnnouncement);

//eNav utility routes - Medications
router.get('/medications/alerts', authenticate, alertMedication);

//Orders
router.patch('/orders/:id/status', authenticate, updateOrderStatus);
router.get('/orders', authenticate, getOrders);

export default router;
