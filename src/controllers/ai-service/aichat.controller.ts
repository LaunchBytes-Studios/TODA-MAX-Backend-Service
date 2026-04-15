import axios from 'axios';
import { randomUUID } from 'crypto';
import { supabase } from '../../config/db';
import { z } from 'zod';
import { requestAiReply } from '../../services/ai.service';
import { getHealthContext } from '../../services/healthContent.service';
import { asyncHandler, HttpError, requirePatientId } from '../../utils/helpers';

const chatbotId = process.env.CHATBOT_ID;
if (!chatbotId) {
  throw new Error('Missing CHATBOT_ID');
}

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

type ChatRole = 'patient' | 'chatbot';

type ChatHistoryItem = {
  role: ChatRole;
  content: string;
};

type PatientContext = {
  name?: string;
  age?: number;
  sex?: string;
  diagnosis?: Record<string, boolean>;
};

type ChatSessionUpdate = Partial<{
  language: string;
  chatbot_active: boolean;
  last_message_at: string;
}>;

const assertChatOwnership = async (chatId: string, patientId: string) => {
  const { data, error } = await supabase
    .from('ChatSession')
    .select('chat_id')
    .eq('chat_id', chatId)
    .eq('patient_id', patientId)
    .single();
  if (error || !data) {
    throw new HttpError(404, 'Chat not found');
  }
};

//helpers for updating session and inserting messages
const updateChatSession = async (chatId: string, fields: ChatSessionUpdate) => {
  if (!fields || Object.keys(fields).length === 0) {
    return;
  }
  const { error } = await supabase.from('ChatSession').update(fields).eq('chat_id', chatId);
  if (error) throw new Error(error.message);
};

const createChatSession = async (patientId: string, language?: string): Promise<string> => {
  const { data, error } = await supabase
    .from('ChatSession')
    .insert([
      {
        patient_id: patientId,
        language: language ?? 'English',
        chatbot_active: true,
        started_at: new Date().toISOString(),
      },
    ])
    .select('chat_id')
    .single();

  if (error || !data?.chat_id) {
    throw new Error(error?.message ?? 'Failed to create chat session');
  }

  return data.chat_id as string;
};

const fetchChatHistory = async (chatId: string): Promise<ChatHistoryItem[]> => {
  const { data, error } = await supabase
    .from('ChatMessages')
    .select('role, content')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: false })
    .limit(6);

  if (error) {
    throw new Error(error.message);
  }
  // if the role was 'user' append on the db should be 'patient' and if the role was 'assistant' append on the db should be 'chatbot'
  const roleMapping: Record<string, ChatRole> = {
    user: 'patient',
    assistant: 'chatbot',
  };

  const rows = (data ?? []).reverse();
  return rows
    .map((row) => ({
      role: roleMapping[row.role] || row.role,
      content: typeof row.content === 'string' ? row.content.trim() : '',
    }))
    .filter((row) => (row.role === 'patient' || row.role === 'chatbot') && row.content.length > 0);
};

const calculateAge = (birthday: string | null): number | null => {
  if (!birthday) {
    return null;
  }

  const date = new Date(birthday);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
    age -= 1;
  }

  return age;
};

const fetchPatientContext = async (patientId: string): Promise<PatientContext | null> => {
  const { data, error } = await supabase
    .from('Patient')
    .select('firstname, surname, sex, diagnosis, birthday')
    .eq('patient_id', patientId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const name = [data.firstname, data.surname].filter(Boolean).join(' ').trim();
  const age = calculateAge(data.birthday ?? null);
  const context: PatientContext = {};

  if (name) {
    context.name = name;
  }
  if (age !== null) {
    context.age = age;
  }
  if (data.sex) {
    context.sex = data.sex;
  }
  if (data.diagnosis) {
    context.diagnosis = data.diagnosis;
  }

  return Object.keys(context).length > 0 ? context : null;
};

export const chatWithAi = asyncHandler('Failed to process chat', async (req, res) => {
  //parsing and validation
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: 'Invalid request body' });
  }

  const chatbotActiveEnv = process.env.CHATBOT_ACTIVE;
  const patientId = requirePatientId(req);
  const { message, chat_id, language, patient_context } = parsed.data;
  const patientContext = await fetchPatientContext(patientId);
  // single patient context merging
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
    // Try to reuse latest chat for this patient
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

  const history = await fetchChatHistory(chatId);
  const healthContext = await getHealthContext(message);
  // Ensure healthContext is always a string (legacy code may have returned Chunk[])
  const healthContextStr = typeof healthContext === 'string' ? healthContext : '';
  const trimmedHealthContext = healthContextStr.trim().slice(0, 4000);
  if (trimmedHealthContext) {
    const preview = trimmedHealthContext.slice(0, 300);
    console.log('Health context preview:', preview);
  } else {
    console.log('Health context preview: (empty)');
  }

  const { data: patientMessage, error: patientMsgError } = await supabase
    .from('ChatMessages')
    .insert({
      message_id: randomUUID(),
      chat_id: chatId,
      role: 'patient',
      sender_id: patientId,
      content: message.trim(),
    })
    .select()
    .single();

  if (patientMsgError) {
    throw new Error(patientMsgError.message);
  }

  // always call AI service, even if health context is empty. AI service will handle fallback/refusal.

  let aiResponse;
  try {
    aiResponse = await requestAiReply({
      message: message.trim(),
      language,
      history,
      health_context: trimmedHealthContext || undefined,
      patient_context:
        Object.keys(mergedPatientContext).length > 0 ? mergedPatientContext : undefined,
    });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      if (status === 429) {
        throw new HttpError(429, 'Gemini quota exceeded or rate limited. Please try again later.');
      }
      if (status === 503) {
        throw new HttpError(503, 'Gemini is experiencing high demand. Please try again later.');
      }
    }
    throw error;
  }

  if (!aiResponse?.reply) {
    if (chatbotActive) {
      throw new Error('AI service returned an empty reply');
    }
  }

  if (!chatbotActive) {
    await updateChatSession(chatId, {
      chatbot_active: false,
      last_message_at: patientMessage.created_at,
    });

    return res.status(200).json({
      success: true,
      data: {
        chat_id: chatId,
        reply: null,
        chatbot_active: false,
      },
    });
  }

  if (aiResponse.chatbot_active === false) {
    await updateChatSession(chatId, { chatbot_active: false });
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
    throw new Error(chatbotMsgError.message);
  }

  await updateChatSession(chatId, { last_message_at: chatbotMessage.created_at });

  return res.json({
    success: true,
    data: {
      chat_id: chatId,
      reply: aiResponse.reply,
      chatbot_active: aiResponse.chatbot_active,
    },
  });
});
