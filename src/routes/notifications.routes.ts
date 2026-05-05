import { Router } from 'express';
import { attachPushTokenToUser } from '../controllers/push-tokens/attachPushTokenToUser';
import { registerPushToken } from '../controllers/push-tokens/registerPushToken.controller';

const router = Router();

router.post('/register-device-token', registerPushToken);
router.post('/attach-token', attachPushTokenToUser);

export default router;
