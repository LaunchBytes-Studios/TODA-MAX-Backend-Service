import { Response } from 'express';
import { supabase } from '../../config/db';
import { randomUUID } from 'crypto';
import { AuthenticatedRequest } from '../../types/patient-chat';
import axios from 'axios';
import { requestAiReply } from '../../services/ai.service';
import { getHealthContext } from '../../services/healthContent.service';

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

    if (chatSession.chatbot_active === false) {
      return res.status(503).json({
        success: false,
        message: 'The chatbot is currently unavailable. Please try again later.',
      });
    }

    // 1. Create patient message
    // We .select() after insert to get the DB-generated 'created_at'
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

    // 2. Build compact chat history for AI context
    const { data: historyRows, error: historyError } = await supabase
      .from('ChatMessages')
      .select('role, content')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: false })
      .limit(6);

    if (historyError) throw historyError;

    const roleMapping: Record<string, 'patient' | 'chatbot'> = {
      user: 'patient',
      assistant: 'chatbot',
    };

    const history = (historyRows ?? [])
      .reverse()
      .map((row) => ({
        role: roleMapping[row.role] || row.role,
        content: typeof row.content === 'string' ? row.content.trim() : '',
      }))
      .filter(
        (row) => (row.role === 'patient' || row.role === 'chatbot') && row.content.length > 0,
      ) as Array<{ role: 'patient' | 'chatbot'; content: string }>;

    // 3. Pull health context and request AI reply
    const healthContext = await getHealthContext(trimmedContent);
    const trimmedHealthContext =
      typeof healthContext === 'string' ? healthContext.trim().slice(0, 4000) : '';

    let aiResponse: { reply: string; chatbot_active: boolean };
    try {
      aiResponse = await requestAiReply({
        message: trimmedContent,
        language: chatSession.language ?? undefined,
        history,
        health_context: trimmedHealthContext || undefined,
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 429) {
          return res.status(429).json({
            success: false,
            message: 'Gemini quota exceeded or rate limited. Please try again later.',
          });
        }
        if (status === 503) {
          return res.status(503).json({
            success: false,
            message: 'Gemini is experiencing high demand. Please try again later.',
          });
        }
      }
      throw error;
    }

    if (!aiResponse?.reply) {
      throw new Error('AI service returned an empty reply');
    }

    // 4. Insert chatbot AI reply message
    const { data: chatbotMessage, error: chatbotMsgError } = await supabase
      .from('ChatMessages')
      .insert({
        message_id: randomUUID(),
        chat_id: chatId,
        role: 'chatbot',
        content: aiResponse.reply,
        sender_id: chatbotId,
      })
      .select()
      .single();

    if (chatbotMsgError) throw chatbotMsgError;

    // 5. Update chat session state after final bot message
    const { error: updateError } = await supabase
      .from('ChatSession')
      .update({
        last_message_at: chatbotMessage.created_at,
        chatbot_active: aiResponse.chatbot_active,
      })
      .eq('chat_id', chatId);

    if (updateError) throw updateError;

    // 6. Return both messages mapped to camelCase for frontend hooks
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
