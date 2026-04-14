import { Router } from 'express';
import { chatWithAi } from '../controllers/ai-service/aichat.controller';
import { authenticatePatient } from '../middleware/auth';

const router = Router();

router.post('/ai', authenticatePatient, chatWithAi);

export default router;
