import { Request, Response } from 'express';
import { supabase } from '../../config/db';
import { v4 as uuidv4 } from 'uuid';

export const sendChatMessage = async (req: Request, res: Response) => {
  try {
    const { chatId, content } = req.body;
    const patientId = (req as any).user?.patient_id;

    if (!chatId || !content) {
      return res.status(400).json({
        success: false,
        message: 'Chat ID and message content are required',
      });
    }

    // Create patient message
    const patientMessageId = uuidv4();
    const { data: patientMessage, error: patientMsgError } = await supabase
      .from('ChatMessages')
      .insert({
        message_id: patientMessageId,
        chat_id: chatId,
        role: 'patient',
        content,
        sender_id: patientId,
      })
      .select()
      .single();

    if (patientMsgError) throw patientMsgError;

    // Update chat session's last_message_at
    const { error: updateError } = await supabase
      .from('ChatSession')
      .update({ last_message_at: new Date().toISOString() })
      .eq('chat_id', chatId);

    if (updateError) throw updateError;

    // Create simulated chatbot reply
    const chatbotMessageId = uuidv4();
    const { data: chatbotMessage, error: chatbotMsgError } = await supabase
      .from('ChatMessages')
      .insert({
        message_id: chatbotMessageId,
        chat_id: chatId,
        role: 'chatbot',
        content: 'This is a chatbot reply',
      })
      .select()
      .single();

    if (chatbotMsgError) throw chatbotMsgError;

    return res.status(201).json({
      success: true,
      data: {
        patientMessage: {
          id: patientMessage.message_id,
          chatId: patientMessage.chat_id,
          role: patientMessage.role,
          content: patientMessage.content,
          createdAt: patientMessage.created_at,
          senderId: patientMessage.sender_id,
        },
        chatbotMessage: {
          id: chatbotMessage.message_id,
          chatId: chatbotMessage.chat_id,
          role: chatbotMessage.role,
          content: chatbotMessage.content,
          createdAt: chatbotMessage.created_at,
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
