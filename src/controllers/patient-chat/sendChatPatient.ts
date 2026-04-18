import { Response } from 'express';
import { supabase } from '../../config/db';
import { randomUUID } from 'crypto';
import { AuthenticatedRequest } from '../../types/patient-chat';
import { requestAiReply } from '../../services/ai.service';

const chatbotId = process.env.CHATBOT_ID;
if (!chatbotId) {
  throw new Error('Missing CHATBOT_ID');
}

export const sendChatMessage = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { chatId, content } = req.body;

    if (!chatId || !content) {
      return res.status(400).json({
        success: false,
        message: 'Chat ID and message content are required',
      });
    }

    const trimmedContent = String(content).trim();
    if (!trimmedContent) {
      return res.status(400).json({
        success: false,
        message: 'Message content must not be empty',
      });
    }

    const { data: chatSession, error: chatSessionError } = await supabase
      .from('ChatSession')
      .select('language, chatbot_active')
      .eq('chat_id', chatId)
      .single();

    if (chatSessionError || !chatSession) {
      return res.status(404).json({
        success: false,
        message: 'Chat session not found',
      });
    }

    // Only insert patient message and update session
    const { data: patientMessage, error: patientMsgError } = await supabase
      .from('ChatMessages')
      .insert({
        message_id: randomUUID(),
        chat_id: chatId,
        role: 'patient',
        content: trimmedContent,
        sender_id: req.user?.userId || null,
      })
      .select()
      .single();

    if (patientMsgError) throw patientMsgError;

    // Update chat session last_message_at
    const { data: chatSessionRefetch, error: sessionError } = await supabase
      .from('ChatSession')
      .select('language, chatbot_active')
      .eq('chat_id', chatId)
      .single();

    if (sessionError || !chatSessionRefetch)
      throw sessionError || new Error('Chat session not found');

    const chatbotActive = chatSessionRefetch.chatbot_active !== false;

    const { error: updateError } = await supabase
      .from('ChatSession')
      .update({
        last_message_at: patientMessage.created_at,
      })
      .eq('chat_id', chatId);

    if (updateError) throw updateError;

    // If chatbot is active, trigger AI reply in background (fire-and-forget)
    if (chatbotActive) {
      // You can add more context/history if needed, or keep it minimal for now
      requestAiReply({
        message: trimmedContent,
        language: chatSessionRefetch.language ?? undefined,
        history: undefined, // or fetch history if needed
        health_context: undefined,
      }).catch((err) => {
        // Log error but do not block response
        console.error('[sendChatMessage AI background error]', err);
      });
    }

    // Return only the patient message (no chatbot reply)
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
