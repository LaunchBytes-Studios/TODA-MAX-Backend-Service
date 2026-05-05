import { Response } from 'express';
import { supabase } from '../../config/db';
import { randomUUID } from 'crypto';
import { AuthenticatedRequest } from '../../types/patient-chat';
import { requestAiReply } from '../../services/ai.service';
import { getUserPushTokens } from '../../utils/getUserPushTokens';
import { sendPushNotifications } from '../../utils/sendPushNotifications';

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
      .select('patient_id, language, chatbot_active')
      .eq('chat_id', chatId)
      .single();

    if (chatSessionError || !chatSession) {
      return res.status(404).json({
        success: false,
        message: 'Chat session not found',
      });
    }

    // Insert patient message
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

    const chatbotActive = chatSession.chatbot_active !== false;

    // Update chat session last_message_at
    const { error: updateError } = await supabase
      .from('ChatSession')
      .update({
        last_message_at: new Date().toISOString(),
      })
      .eq('chat_id', chatId);

    if (updateError) throw updateError;

    const tokens = await getUserPushTokens(chatSession.patient_id);

    if (tokens.length > 0) {
      sendPushNotifications(
        tokens,
        'New message from eNavigator',
        content.length > 80 ? content.slice(0, 80) + '...' : content,
        {
          type: 'chat',
          id: chatId,
        },
      ).catch(console.error);
    }

    // If chatbot is active, trigger AI reply in background
    if (chatbotActive) {
      requestAiReply({
        message: trimmedContent,
        language: chatSession.language ?? undefined,
        history: undefined,
        health_context: undefined,
      }).catch((err) => {
        console.error('[sendChatMessage AI background error]', err);
      });
    }

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
