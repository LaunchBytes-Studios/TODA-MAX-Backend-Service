import express from 'express';
import { checkout } from '../controllers/patient-orders/checkout.controller';
import { confirmOrder } from '../controllers/patient-orders/confirmOrder.controller';
import { getPatientOrders } from '../controllers/patient-orders/getOrders.controller';
import { authenticatePatient } from '../middleware/auth';

const router = express.Router();

// Create new order (checkout)
router.post('/checkout', authenticatePatient, checkout);

// Get all Order records for the authenticated patient
router.get('/', authenticatePatient, getPatientOrders);

// Patient confirms receipt of a delivered order
router.patch('/:orderId/confirm', authenticatePatient, confirmOrder);

export default router;
