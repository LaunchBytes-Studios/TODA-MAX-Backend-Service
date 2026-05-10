import { Router } from 'express';
import { attachPushTokenToUser } from '../controllers/push-tokens/attachPushTokenToUser';
import { registerPushToken } from '../controllers/push-tokens/registerPushToken.controller';
import { authenticatePatient } from '../middleware/auth';
import { detachPushTokenFromUser } from '../controllers/push-tokens/detachPushTokenFromUser';

const router = Router();

router.post('/register-device-token', registerPushToken);
router.post('/attach-token', authenticatePatient, attachPushTokenToUser);
router.post('/detach-token', authenticatePatient, detachPushTokenFromUser);

export default router;
