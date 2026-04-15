import express from 'express';
import {
  createReward,
  deleteReward,
  getAllRewards,
  getRewardById,
  updateReward,
} from '../controllers/reward/reward.controller';
import { authenticate } from '../middleware/enav.middleware';

const router = express.Router();

router.use(authenticate);

router.get('/', getAllRewards);
router.get('/:id', getRewardById);
router.post('/', createReward);
router.put('/:id', updateReward);
router.delete('/:id', deleteReward);

export default router;
