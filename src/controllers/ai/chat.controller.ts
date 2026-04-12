import { supabase } from '../../config/db';
import { z } from 'zod';
import { requestAiReply } from '../../services/ai.service';
import { asyncHandler, HttpError, requirePatientId } from '../../utils/helpers';

const chatbotId = process.env.CHATBOT_ID;
if (!chatbotId) {
  throw new Error('Missing CHATBOT_ID');
}

const chatSchema = z.object({
  message: z.string().trim().min(2).max(1000),
  chat_id: z.string().uuid().optional(),
  language: z.string().trim().max(100).optional(),
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
  diagnosis?: unknown;
};

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

const createChatSession = async (patientId: string, language?: string): Promise<string> => {
  const { data, error } = await supabase
    .from('ChatSession')
    .insert([
      {
        patient_id: patientId,
        language: language ?? 'English',
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
  const roleMapping: { [key: string]: ChatRole } = {
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
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: 'Invalid request body' });
  }

  const chatbotActiveEnv = process.env.CHATBOT_ACTIVE;
  if (chatbotActiveEnv && chatbotActiveEnv !== 'true') {
    return res.status(503).json({
      success: false,
      message: 'The chatbot is currently unavailable. Please try again later.',
    });
  }

  const patientId = requirePatientId(req);
  const { message, chat_id, language } = parsed.data;
  const patientContext = await fetchPatientContext(patientId);

  let chatId = chat_id as string;
  if (chatId) {
    await assertChatOwnership(chatId, patientId);
    const { data: chatSession, error: chatSessionError } = await supabase
      .from('ChatSession')
      .select('chatbot_active')
      .eq('chat_id', chatId)
      .single();

    if (chatSessionError) {
      throw new Error(chatSessionError.message);
    }

    if (chatSession?.chatbot_active === false) {
      return res.status(503).json({
        success: false,
        message: 'The chatbot is currently unavailable. Please try again later.',
      });
    }

    if (language) {
    await supabase
      .from('ChatSession')
      .update({ language })
      .eq('chat_id', chatId);
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
  if (existing.chatbot_active === false) {
    return res.status(503).json({
      success: false,
      message: 'The chatbot is currently unavailable. Please try again later.',
    });
  }
  chatId = existing.chat_id;
  if (language && existing.language !== language) {
    await supabase
      .from('ChatSession')
      .update({ language })
      .eq('chat_id', chatId);
  }
}

    if (existingErr && existingErr.code !== 'PGRST116') {
      throw new Error(existingErr.message);
    }

    chatId = existing?.chat_id ?? (await createChatSession(patientId, language));
  }
  

  const history = await fetchChatHistory(chatId);
  const aiResponse = await requestAiReply({
    message: message.trim(),
    language,
    history,
    patient_context: patientContext ?? undefined,
  });

  if (!aiResponse?.reply) {
    throw new Error('AI service returned an empty reply');
  }

  if (aiResponse.chatbot_active === false) {
  await supabase
    .from('ChatSession')
    .update({ chatbot_active: false })
    .eq('chat_id', chatId);
}

  const { error: insertError } = await supabase.from('ChatMessages').insert([
    {
      chat_id: chatId,
      role: 'patient',
      sender_id: patientId,
      content: message.trim(),
    },
    {
      chat_id: chatId,
      role: 'chatbot',
      sender_id: chatbotId,
      content: aiResponse.reply,
    },
  ]);

  if (insertError) {
    throw new Error(insertError.message);
  }

  const { error: sessionUpdateError } = await supabase
    .from('ChatSession')
    .update({ last_message_at: new Date().toISOString() })
    .eq('chat_id', chatId);

  if (sessionUpdateError) {
    throw new Error(sessionUpdateError.message);
  }

  return res.json({
  success: true,
  data: {
    chat_id: chatId,
    reply: aiResponse.reply,
    chatbot_active: aiResponse.chatbot_active,
  },
});
});
