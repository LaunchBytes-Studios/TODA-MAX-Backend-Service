import { supabase } from '../../config/db';
import { HttpError } from '../../utils/helpers';

type ChatRole = 'patient' | 'chatbot';
export type ChatHistoryItem = {
  role: ChatRole;
  content: string;
};
export type PatientContext = {
  name?: string;
  age?: number;
  sex?: string;
  diagnosis?: Record<string, boolean>;
};
export type ChatSessionUpdate = Partial<{
  language: string;
  chatbot_active: boolean;
  last_message_at: string;
}>;

export const assertChatOwnership = async (chatId: string, patientId: string) => {
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

export const updateChatSession = async (chatId: string, fields: ChatSessionUpdate) => {
  if (!fields || Object.keys(fields).length === 0) {
    return;
  }
  const { error } = await supabase.from('ChatSession').update(fields).eq('chat_id', chatId);
  if (error) throw new Error(error.message);
};

export const createChatSession = async (patientId: string, language?: string): Promise<string> => {
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

export const fetchChatHistory = async (chatId: string): Promise<ChatHistoryItem[]> => {
  const { data, error } = await supabase
    .from('ChatMessages')
    .select('role, content')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: false })
    .limit(6);

  if (error) {
    throw new Error(error.message);
  }
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

export const calculateAge = (birthday: string | null): number | null => {
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

export const fetchPatientContext = async (patientId: string): Promise<PatientContext | null> => {
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
