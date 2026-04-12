import axios from 'axios';

type ChatRole = 'patient' | 'chatbot';

export type ChatHistoryItem = {
  role: ChatRole;
  content: string;
};

export type AiChatRequest = {
  message: string;
  language?: string;
  history?: ChatHistoryItem[];
  patient_context?: {
    name?: string;
    age?: number;
    sex?: string;
    diagnosis?: unknown;
  };
};

export type AiChatResponse = {
  reply: string;
  chatbot_active: boolean;
};

const getAiServiceConfig = () => {
  const url = process.env.AI_SERVICE_URL;
  const key = process.env.AI_SERVICE_KEY;

  if (!url || !key) {
    throw new Error('Missing AI_SERVICE_URL or AI_SERVICE_KEY');
  }

  return { url, key };
};

export const requestAiReply = async (payload: AiChatRequest): Promise<AiChatResponse> => {
  const { url, key } = getAiServiceConfig();

  const response = await axios.post<AiChatResponse>(`${url}/chat`, payload, {
    headers: {
      'x-service-key': key,
      'content-type': 'application/json',
    },
    timeout: 15000,
  });

  return response.data;
};
