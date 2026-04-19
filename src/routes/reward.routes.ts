import express from 'express';
import {
  createReward,
  deleteReward,
  getAllRewards,
  getRewardById,
  updateReward,
} from '../controllers/reward/reward.controller';
import {
  getMyRewardClaims,
  cancelRewardClaim,
  redeemRewardByPatient,
} from '../controllers/reward/patientReward.controller';
import { authenticate } from '../middleware/enav.middleware';
import { authenticatePatient } from '../middleware/auth';

const router = express.Router();

router.get('/claims/me', authenticatePatient, getMyRewardClaims);
router.post('/claims/cancel', authenticatePatient, cancelRewardClaim);
router.post('/claims/:code/cancel', authenticatePatient, cancelRewardClaim);
router.get('/', authenticatePatient, getAllRewards);
router.get('/:id', authenticatePatient, getRewardById);
router.post('/:id/redeem', authenticatePatient, redeemRewardByPatient);

router.post('/', authenticate, createReward);
router.put('/:id', authenticate, updateReward);
router.delete('/:id', authenticate, deleteReward);

export default router;
