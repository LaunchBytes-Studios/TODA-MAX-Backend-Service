import { Router } from 'express';
import { login, me } from '../controllers/enavigator/loginEnav';
import { authenticate } from '../middleware/enav.middleware';

import { generateRegistrationCode } from '../controllers/registration/generateRegistrationCodes.controller';
import { getRegistrationCode } from '../controllers/registration/getRegistrationCode.controller';
import { maintenanceRegistrationCode } from '../controllers/registration/maintenanceRegistration.controller';
import { makeAnnouncement } from '../controllers/announcement/postAnnouncement.controller';
import { getAnnouncement } from '../controllers/announcement/getAnnouncement.controller';
import { alertMedication } from '../controllers/medication/alertMedication.controller';
import {
  finalizeRewardCode,
  verifyRewardCode,
} from '../controllers/reward/rewardVerification.controller';
import { getOrders, updateOrderStatus } from '../controllers/enav-orders/order.controller';
import { getChatSessionsWithPatients } from '../controllers/enav-chats/getSessionsWithPatients';
import { getMessagesByChatId } from '../controllers/enav-chats/getMessages';
import { sendMessage } from '../controllers/enav-chats/sendMessage';
import { updateChatbotStatus } from '../controllers/enav-chats/updateChatbotStatus';
import { getChatSessionById } from '../controllers/enav-chats/getChatSessionById';

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

//eNav utility routes - Reward Codes
router.get('/rewardCodes/verify', authenticate, verifyRewardCode);
router.post('/rewardCodes/finalize', authenticate, finalizeRewardCode);
//Orders
router.patch('/orders/:id/status', authenticate, updateOrderStatus);
router.get('/orders', authenticate, getOrders);

//eNav utility routes - Support Chat
router.get('/supportChat/chat-sessions', authenticate, getChatSessionsWithPatients);
router.get('/supportChat/:chatId', authenticate, getChatSessionById);
router.get('/supportChat/:chatId/messages', authenticate, getMessagesByChatId);
router.post('/supportChat/:chatId/messages', authenticate, sendMessage);
router.patch('/supportChat/:chatId/chatbot', authenticate, updateChatbotStatus);

export default router;
