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

const router = express.Router();
router.get('/', getAllMedications);
router.get('/stats', getMedicationStats);
router.get('/search', searchMedications);
router.get('/:id', getMedicationById);
router.post('/', createMedication);
router.put('/:id', updateMedication);
router.patch('/:id/stock', updateMedicationStock);
router.delete('/:id', deleteMedication);

export default router;
