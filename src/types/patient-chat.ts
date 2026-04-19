import { Request } from 'express';
import { Patient } from './patient';

/**
 * JWT Payload structure matching auth middleware
 */
export interface JwtPayload {
  userId: string;
  role: string;
  contact: string;
}

/**
 * Extended Express Request with authenticated user
 */
export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

/**
 * Chat session data structure
 */
export interface ChatMessage {
  message_id: string;
  chat_id: string;
  role: string;
  content: string;
  created_at: string;
  sender_id: string | null;
}

export interface ChatSessionBase {
  chat_id: string;
  patient_id: string;
  language: string | null;
  started_at: string;
  last_message_at: string | null;
  chatbot_active: boolean;
  last_read_at: string | null;
  unread_count: number;
}

export interface ChatSessionWithPatient extends ChatSessionBase {
  patient: Patient | null;
}
