import axios from 'axios';
import { randomUUID } from 'crypto';
import { Response, Request } from 'express';
import { supabase } from '../../config/db';
import { z } from 'zod';
import { requestAiReply } from '../../services/ai.service';
import { getHealthContext } from '../../services/healthContent.service';
import { requirePatientId } from '../../utils/helpers';
import {
  ChatHistoryItem,
  fetchChatHistory,
  fetchPatientContext,
  updateChatSession,
  assertChatOwnership,
  createChatSession,
} from './sessionHelpers';


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

export const chatWithAi = async (req: Request, res: Response): Promise<Response> => {
  console.log('[chatWithAiHandler] Incoming request:', {
    body: req.body,
    patientId: req.user?.userId || req.headers['x-patient-id'] || null,
  });
  const parsed = chatSchema.safeParse(req.body);

  if (!parsed.success) {
    console.log('[chatWithAiHandler] Invalid request body:', req.body);
    return res.status(400).json({ success: false, message: 'Invalid request body' });
  }

  const chatbotActiveEnv = process.env.CHATBOT_ACTIVE;
  const chatbotId = process.env.CHATBOT_ID;
  if (!chatbotId) throw new Error('Missing CHATBOT_ID');
  console.log('[chatWithAiHandler] Parsed data:', parsed.data);
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
  const { error: patientMsgError } = await supabase
    .from('ChatMessages')
    .insert({
      message_id: randomUUID(),
      chat_id: chatId,
      role: 'patient',
      sender_id: patientId,
      content: message.trim(),
    });
  if (patientMsgError) throw new Error(patientMsgError.message);

  // Respond immediately to the client (do not wait for AI)
  res.status(200).json({
    success: true,
    data: {
      chat_id: chatId,
      reply: null, // reply will be appended in realtime
      chatbot_active: chatbotActive,
    },
  });
  console.log('[chatWithAiHandler] Responded to client, starting AI background logic...');

  // --- AI reply logic in background ---

  setImmediate(async () => {
    try {
      console.log('[chatWithAiHandler] [AI background] Fetching chat history for chatId:', chatId);
      const history = await fetchChatHistory(chatId);
      const buildConversationQuery = (history: ChatHistoryItem[], latestMessage: string) =>
        [...history.map((item) => item.content), latestMessage.trim()].join(' ').trim();
      const conversationQuery = buildConversationQuery(history, message).slice(0, 4000);
      const healthContext = await getHealthContext(conversationQuery);
      const healthContextStr = typeof healthContext === 'string' ? healthContext : '';
      const trimmedHealthContext = healthContextStr.trim().slice(0, 4000);

      let aiResponse;
      try {
        console.log('[chatWithAiHandler] [AI background] Calling requestAiReply with:', {
          message: message.trim(),
          language,
          historyLength: history.length,
          health_context: trimmedHealthContext ? '[present]' : '[empty]',
          patient_context: Object.keys(mergedPatientContext).length > 0 ? '[present]' : '[empty]',
        });
        aiResponse = await requestAiReply({
          message: message.trim(),
          language: language,
          history,
          health_context: trimmedHealthContext || undefined,
          patient_context:
            Object.keys(mergedPatientContext).length > 0 ? mergedPatientContext : undefined,
        });
        console.log('[chatWithAiHandler] [AI background] AI response:', aiResponse);
      } catch (error) {
        console.error('[chatWithAiHandler] [AI background] Error calling requestAiReply:', error);
        if (axios.isAxiosError(error)) {
          const status = error.response?.status;
          if (status === 429 || status === 503) {
            // Optionally: log or notify about quota exceeded or high demand
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

      const { data: chatbotMessage, error: chatbotMsgError } = await supabase
        .from('ChatMessages')
        .insert({
          message_id: randomUUID(),
          chat_id: chatId,
          role: 'chatbot',
          sender_id: chatbotId,
          content: aiResponse.reply,
        })
        .select()
        .single();
      if (chatbotMsgError) {
        console.error('Failed to insert chatbot message:', chatbotMsgError);
        return;
      }

      await updateChatSession(chatId, { last_message_at: chatbotMessage.created_at });
      // The frontend will receive this new message via realtime updates
    } catch (err) {
      console.error('Error in AI reply logic', err);
    }
  });
  return res;
};
