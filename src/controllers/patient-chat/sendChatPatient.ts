import { Response } from 'express';
import { supabase } from '../../config/db';
import { v4 as uuidv4 } from 'uuid';
import { AuthenticatedRequest } from '../../types/patient-chat';

export const sendChatMessage = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { chatId, content } = req.body;

    if (!chatId || !content) {
      return res.status(400).json({
        success: false,
        message: 'Chat ID and message content are required',
      });
    }

    // 1. Create patient message
    // We .select() after insert to get the DB-generated 'created_at'
    const { data: patientMessage, error: patientMsgError } = await supabase
      .from('ChatMessages')
      .insert({
        message_id: uuidv4(),
        chat_id: chatId,
        role: 'patient',
        content,
        sender_id: req.user?.userId || null,
      })
      .select()
      .single();

    if (patientMsgError) throw patientMsgError;

    // 2. Update chat session's last_message_at
    // We use the patient message's created_at to keep session and message times identical
    const { error: updateError } = await supabase
      .from('ChatSession')
      .update({ last_message_at: patientMessage.created_at })
      .eq('chat_id', chatId);

    if (updateError) throw updateError;

    // 3. Create simulated chatbot reply
    const { data: chatbotMessage, error: chatbotMsgError } = await supabase
      .from('ChatMessages')
      .insert({
        message_id: uuidv4(),
        chat_id: chatId,
        role: 'chatbot',
        content: 'I understand. How can I assist you further?',
      })
      .select()
      .single();

    if (chatbotMsgError) throw chatbotMsgError;

    // 4. Return data mapped to camelCase for your Frontend Hooks
    return res.status(201).json({
      success: true,
      data: {
        patientMessage: {
          id: patientMessage.message_id,
          chatId: patientMessage.chat_id,
          role: patientMessage.role,
          content: patientMessage.content,
          createdAt: patientMessage.created_at, // The actual DB timestamp
          senderId: patientMessage.sender_id,
        },
        chatbotMessage: {
          id: chatbotMessage.message_id,
          chatId: chatbotMessage.chat_id,
          role: chatbotMessage.role,
          content: chatbotMessage.content,
          createdAt: chatbotMessage.created_at, // The actual DB timestamp
          senderId: chatbotMessage.sender_id,
        },
      },
    });
  } catch (error) {
    console.error('[sendChatMessage error]', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send chat message',
    });
  }
};
