import express from 'express';
import {
  getAllMedications,
  getMedicationById,
  createMedication,
  updateMedication,
  deleteMedication,
  updateMedicationStock,
  getMedicationStats,
  searchMedications,
} from '../controllers/medication/medication.controller';
import { authenticate } from '../middleware/enav.middleware';

const router = express.Router();

router.get('/', getAllMedications);
router.get('/stats', getMedicationStats);
router.get('/search', searchMedications);
router.get('/:id', getMedicationById);
router.post('/', authenticate, createMedication);
router.put('/:id', authenticate, updateMedication);
router.patch('/:id/stock', authenticate, updateMedicationStock);
router.delete('/:id', authenticate, deleteMedication);

export default router;
