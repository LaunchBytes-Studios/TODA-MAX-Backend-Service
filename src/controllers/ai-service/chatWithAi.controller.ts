import axios from 'axios';
import { randomUUID } from 'crypto';
import { Response, Request } from 'express';
import { supabase } from '../../config/db';
import { z } from 'zod';
import { requestAiReply } from '../../services/ai.service';
import { getHealthContext } from '../../services/healthContent.service';
import { asyncHandler, requirePatientId } from '../../utils/helpers';
import {
  ChatHistoryItem,
  fetchChatHistory,
  fetchPatientContext,
  updateChatSession,
  assertChatOwnership,
  createChatSession,
} from './sessionHelpers';
import { getUserPushTokens } from '../../utils/getUserPushTokens';
import { sendPushNotifications } from '../../utils/sendPushNotifications';

const chatSchema = z.object({
  message: z.string().trim().min(2).max(1000),
  chat_id: z.string().uuid().optional(),
  language: z.string().trim().max(100).optional(),
  patient_context: z
    .object({
      name: z.string().trim().max(200).optional(),
      age: z.number().int().min(0).max(130).optional(),
      sex: z.string().trim().max(50).optional(),
      diagnosis: z.record(z.string(), z.boolean()).optional(),
    })
    .optional(),
});

// Generate a stable request ID for debugging across logs.
const getRequestId = (value: unknown): string => {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim()) {
    return value[0].trim();
  }

  return randomUUID();
};

const insertChatbotMessage = async (chatId: string, chatbotId: string, content: string) => {
  const { data: chatbotMessage, error: chatbotMsgError } = await supabase
    .from('ChatMessages')
    .insert({
      message_id: randomUUID(),
      chat_id: chatId,
      role: 'chatbot',
      sender_id: chatbotId,
      content,
    })
    .select()
    .single();

  if (chatbotMsgError) {
    throw new Error(chatbotMsgError.message);
  }

  await updateChatSession(chatId, { last_message_at: chatbotMessage.created_at });
  return chatbotMessage;
};

export const chatWithAi = asyncHandler('chatWithAi', async (req: Request, res: Response) => {
  // Trace one chat request across the backend and AI service logs for debugging.
  const requestId = getRequestId(req.headers['x-request-id']);
  const debugEnabled =
    process.env.AI_DEBUG_LOGS === 'true' || process.env.NODE_ENV !== 'production';
  if (debugEnabled) {
    console.log('[chatWithAiHandler] Incoming request:', {
      requestId,
      body: {
        message: req.body?.message,
        chat_id: req.body?.chat_id,
        language: req.body?.language,
        has_patient_context: Boolean(req.body?.patient_context),
      },
      patientId: req.user?.userId || req.headers['x-patient-id'] || null,
    });
  }
  const parsed = chatSchema.safeParse(req.body);

  if (!parsed.success) {
    if (debugEnabled) {
      console.log('[chatWithAiHandler] Invalid request body:', req.body);
    }
    return res.status(400).json({ success: false, message: 'Invalid request body' });
  }

  const chatbotActiveEnv = process.env.CHATBOT_ACTIVE;
  const chatbotId = process.env.CHATBOT_ID;
  if (!chatbotId) throw new Error('Missing CHATBOT_ID');
  if (debugEnabled) {
    console.log('[chatWithAiHandler] Parsed data:', {
      requestId,
      message: parsed.data.message,
      chat_id: parsed.data.chat_id,
      language: parsed.data.language,
      has_patient_context: Boolean(parsed.data.patient_context),
    });
  }
  const patientId = requirePatientId(req);
  const { message, chat_id, language, patient_context } = parsed.data;
  const patientContext = await fetchPatientContext(patientId);
  const mergedPatientContext = {
    ...(patient_context && Object.keys(patient_context).length > 0 ? patient_context : {}),
    ...(patientContext && Object.keys(patientContext).length > 0 ? patientContext : {}),
  };

  let chatId = chat_id as string;
  let chatbotActive = chatbotActiveEnv ? chatbotActiveEnv === 'true' : true;
  if (chatId) {
    await assertChatOwnership(chatId, patientId);
    const { data: chatSession, error: chatSessionError } = await supabase
      .from('ChatSession')
      .select('chatbot_active')
      .eq('chat_id', chatId)
      .single();
    if (chatSessionError) throw new Error(chatSessionError.message);
    chatbotActive = chatbotActive && chatSession?.chatbot_active !== false;
    if (language) {
      await updateChatSession(chatId, { language });
    }
  } else {
    const { data: existing, error: existingErr } = await supabase
      .from('ChatSession')
      .select('chat_id, language, chatbot_active')
      .eq('patient_id', patientId)
      .order('started_at', { ascending: false })
      .limit(1)
      .single();
    if (existing?.chat_id) {
      chatbotActive = chatbotActive && existing.chatbot_active !== false;
      chatId = existing.chat_id;
      if (language && existing.language !== language) {
        await updateChatSession(chatId, { language });
      }
    }
    if (existingErr && existingErr.code !== 'PGRST116') {
      throw new Error(existingErr.message);
    }
    chatId = existing?.chat_id ?? (await createChatSession(patientId, language));
  }

  // Insert patient message
  const { error: patientMsgError } = await supabase.from('ChatMessages').insert({
    message_id: randomUUID(),
    chat_id: chatId,
    role: 'patient',
    sender_id: patientId,
    content: message.trim(),
  });
  if (patientMsgError) throw new Error(patientMsgError.message);

  // Respond immediately to the client (do not wait for AI)
  res.setHeader('x-request-id', requestId);
  res.status(200).json({
    success: true,
    data: {
      chat_id: chatId,
      reply: null, // reply will be appended in realtime
      chatbot_active: chatbotActive,
    },
  });
  if (debugEnabled) {
    console.log('[chatWithAiHandler] Responded to client, starting AI background logic...', {
      requestId,
      chatId,
    });
  }

  // --- AI reply logic in background ---

  setImmediate(async () => {
    try {
      if (debugEnabled) {
        console.log(
          '[chatWithAiHandler] [AI background] Fetching chat history for chatId:',
          chatId,
        );
      }
      const history = await fetchChatHistory(chatId);
      const buildConversationQuery = (history: ChatHistoryItem[], latestMessage: string) =>
        [...history.map((item) => item.content), latestMessage.trim()].join(' ').trim();
      const conversationQuery = buildConversationQuery(history, message).slice(0, 4000);
      const healthContext = await getHealthContext(conversationQuery);
      const healthContextStr = typeof healthContext === 'string' ? healthContext : '';
      const trimmedHealthContext = healthContextStr.trim().slice(0, 4000);

      let aiResponse;
      try {
        if (debugEnabled) {
          console.log('[chatWithAiHandler] [AI background] Calling requestAiReply with:', {
            requestId,
            message: message.trim(),
            language,
            historyLength: history.length,
            health_context: trimmedHealthContext ? '[present]' : '[empty]',
            patient_context: Object.keys(mergedPatientContext).length > 0 ? '[present]' : '[empty]',
          });
        }
        aiResponse = await requestAiReply(
          {
            message: message.trim(),
            language: language,
            history,
            health_context: trimmedHealthContext || undefined,
            request_id: requestId,
            patient_context:
              Object.keys(mergedPatientContext).length > 0 ? mergedPatientContext : undefined,
          },
          { requestId },
        );
        if (debugEnabled) {
          console.log('[chatWithAiHandler] [AI background] AI response:', {
            requestId,
            chatbot_active: aiResponse.chatbot_active,
            hasReply: Boolean(aiResponse.reply),
          });
        }
      } catch (error) {
        console.error('[chatWithAiHandler] [AI background] Error calling requestAiReply:', {
          requestId,
          error,
        });
        if (axios.isAxiosError(error)) {
          const status = error.response?.status;
          if (status === 429 || status === 503) {
            return;
          }
        }

        return;
      }

      if (!aiResponse?.reply) {
        return;
      }

      // Keep session state aligned with the latest AI decision so chatbot
      // can recover from older false states when the current message is allowed.
      if (aiResponse.chatbot_active === false) {
        await updateChatSession(chatId, { chatbot_active: false });
      } else {
        await updateChatSession(chatId, { chatbot_active: true });
      }

      await insertChatbotMessage(chatId, chatbotId, aiResponse.reply);

      const tokens = await getUserPushTokens(patientId);

      if (tokens.length > 0) {
        const preview =
          aiResponse.reply.length > 80 ? aiResponse.reply.slice(0, 80) + '...' : aiResponse.reply;

        sendPushNotifications(tokens, 'New message from AI Chatbot', preview, {
          type: 'chat',
          id: chatId,
        }).catch(console.error);
      }

      // The frontend will receive this new message via realtime updates
    } catch (err) {
      console.error('Error in AI reply logic', { requestId, err });
    }
  });
  return res;
});
