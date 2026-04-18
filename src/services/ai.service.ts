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
  health_context?: string;
  patient_context?: {
    name?: string;
    age?: number;
    sex?: string;
    diagnosis?: Record<string, boolean>;
  };
};

export type AiChatResponse = {
  reply: string;
  chatbot_active: boolean;
};

const getAiServiceConfig = () => {
  const url = process.env.AI_SERVICE_URL;
  const key = process.env.AI_SERVICE_KEY;
  const timeout = Number(process.env.AI_SERVICE_TIMEOUT_MS ?? 60000); // Increased default timeout to 60s

  if (!url || !key) {
    throw new Error('Missing AI_SERVICE_URL or AI_SERVICE_KEY');
  }

  return { url, key, timeout };
};

export const requestAiReply = async (payload: AiChatRequest): Promise<AiChatResponse> => {
  const { url, key, timeout } = getAiServiceConfig();

  const response = await axios.post<AiChatResponse>(`${url}/chat`, payload, {
    headers: {
      'x-service-key': key,
      'content-type': 'application/json',
    },
    timeout,
  });

  return response.data;
};
