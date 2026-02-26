// filepath: src/routes/ordering.routes.ts

import express from 'express';
import {
  getAllOrderItems,
  getOrderItemById,
  getOrderItems,
  getOrderItemsWithDetails,
  createOrderItem,
  updateOrderItem,
  deleteOrderItem,
  checkout,
} from '../controllers/ordering/getOrderItem.controller';
import { authenticatePatient } from '../middleware/auth';

const router = express.Router();

// Checkout - Create new order
router.post('/checkout', authenticatePatient, checkout);

// Create new order item
router.post('/', authenticatePatient, createOrderItem);

// Get a specific order item by ID (protected) - must come before /:orderId
router.get('/item/:id', authenticatePatient, getOrderItemById);

// Update order item
router.put('/item/:id', authenticatePatient, updateOrderItem);

// Delete order item
router.delete('/item/:id', authenticatePatient, deleteOrderItem);

// Get order items with medication details (join) - must come before /:orderId
router.get('/:orderId/details', authenticatePatient, getOrderItemsWithDetails);

// Get all items in a specific order for the authenticated patient
router.get('/:orderId', authenticatePatient, getOrderItems);

// Get all order items for authenticated patient with pagination and filters
router.get('/', authenticatePatient, getAllOrderItems);

export default router;
