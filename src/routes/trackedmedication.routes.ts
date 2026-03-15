import { Router } from 'express';
import { authenticatePatient } from '../middleware/auth';
import { getTrackedMedications } from '../controllers/tracked-medication/getTrackedMedications';
import { toggleDayDose } from '../controllers/tracked-medication/toggleDayDose';
import { createTrackedMedication } from '../controllers/tracked-medication/createTrackedMedication';
import { deleteTrackedMedication } from '../controllers/tracked-medication/deleteTrackedMedication';
import { getDailyMedications } from '../controllers/tracked-medication/getDailyMedications';
import { getMedicationCalendar } from '../controllers/tracked-medication/getMedicationCalendar';
import { updateTrackedMedication } from '../controllers/tracked-medication/updateTrackedMedication';

const router = Router();

router.get('/', authenticatePatient, getTrackedMedications);
router.get('/daily', authenticatePatient, getDailyMedications);
router.get('/calendar', authenticatePatient, getMedicationCalendar);
router.post('/create', authenticatePatient, createTrackedMedication);
router.patch('/dose/:doseId/toggle', authenticatePatient, toggleDayDose);
router.patch('/:id', authenticatePatient, updateTrackedMedication);
router.delete('/:id', authenticatePatient, deleteTrackedMedication);

export default router;
