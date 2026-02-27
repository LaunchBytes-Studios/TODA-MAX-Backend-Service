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

// Create new order (checkout)
router.post('/checkout', authenticatePatient, checkout);

// Get order items with medication details (for order review/cart)
router.get('/:orderId/details', authenticatePatient, getOrderItemsWithDetails);

// Get all items in a specific order (order history, current order)
router.get('/:orderId', authenticatePatient, getOrderItems);

// Get all order items for authenticated patient (order history, cart)
router.get('/', authenticatePatient, getAllOrderItems);

// Get a specific order item by ID (for cart review)
router.get('/item/:id', authenticatePatient, getOrderItemById);

// Create new order item (for cart functionality)
router.post('/', authenticatePatient, createOrderItem);

// Update order item (for cart editing)
router.put('/item/:id', authenticatePatient, updateOrderItem);

// Delete order item (for cart removal)
router.delete('/item/:id', authenticatePatient, deleteOrderItem);

export default router;
