import { Router } from 'express';
import { getChatSession } from '../controllers/patient-chat/getChatSession';
import { sendChatMessage } from '../controllers/patient-chat/sendChatPatient';
import { setLanguagePreference } from '../controllers/patient-chat/setLanguagePreference';
import { authenticatePatient } from '../middleware/auth';
import { streamChatMessages } from '../controllers/patient-chat/streamChatMessages';
import { chatWithAi } from '../controllers/ai-service/aichat.controller';

const router = Router();

// Get or create chat session for a patient (no auth required, uses patientId param)
router.get('/session/:patientId', getChatSession);

// Set language preference for a chat session (auth required)
router.post('/session/language', authenticatePatient, setLanguagePreference);

// Send a chat message (auth required)
router.post('/message', authenticatePatient, sendChatMessage);
router.get('/stream/:chatId', streamChatMessages);
router.post('/ai', authenticatePatient, chatWithAi);

export default router;
