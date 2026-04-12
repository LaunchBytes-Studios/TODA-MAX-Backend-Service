import { Router } from 'express';
import { chatWithAi } from '../controllers/ai/chat.controller';
import { authenticatePatient } from '../middleware/auth';

const router = Router();

router.post('/chat', authenticatePatient, chatWithAi);

export default router;
