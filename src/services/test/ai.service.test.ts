import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { requestAiReply, type AiChatRequest, type AiChatResponse } from '../ai.service';

// Mock axios
vi.mock('axios');

describe('ai.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up environment variables
    process.env.AI_SERVICE_URL = 'http://localhost:5000';
    process.env.AI_SERVICE_KEY = 'test-api-key';
    process.env.AI_SERVICE_TIMEOUT_MS = '30000';
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.AI_SERVICE_URL;
    delete process.env.AI_SERVICE_KEY;
    delete process.env.AI_SERVICE_TIMEOUT_MS;
  });

  describe('requestAiReply', () => {
    it('should successfully send a chat request and return response', async () => {
      const mockResponse: AiChatResponse = {
        reply: 'Hello! How can I help you today?',
        chatbot_active: true,
      };

      vi.mocked(axios.post).mockResolvedValueOnce({
        data: mockResponse,
      });

      const payload: AiChatRequest = {
        message: 'Hello',
        language: 'en',
      };

      const result = await requestAiReply(payload);

      expect(result).toEqual(mockResponse);
      expect(axios.post).toHaveBeenCalledWith(
        'http://localhost:5000/chat',
        payload,
        expect.objectContaining({
          headers: {
            'x-service-key': 'test-api-key',
            'content-type': 'application/json',
          },
          timeout: 30000,
        })
      );
    });

    it('should include chat history in request when provided', async () => {
      const mockResponse: AiChatResponse = {
        reply: 'Based on our conversation...',
        chatbot_active: true,
      };

      vi.mocked(axios.post).mockResolvedValueOnce({
        data: mockResponse,
      });

      const payload: AiChatRequest = {
        message: 'Tell me more',
        language: 'en',
        history: [
          { role: 'patient', content: 'Hello' },
          { role: 'chatbot', content: 'Hi there!' },
        ],
      };

      const result = await requestAiReply(payload);

      expect(result).toEqual(mockResponse);
      expect(axios.post).toHaveBeenCalledWith(
        'http://localhost:5000/chat',
        expect.objectContaining({
          history: payload.history,
        }),
        expect.anything()
      );
    });

    it('should include health context in request when provided', async () => {
      const mockResponse: AiChatResponse = {
        reply: 'Based on the health information...',
        chatbot_active: true,
      };

      vi.mocked(axios.post).mockResolvedValueOnce({
        data: mockResponse,
      });

      const payload: AiChatRequest = {
        message: 'I have diabetes',
        language: 'en',
        health_context: 'Patient has Type 2 diabetes',
      };

      const result = await requestAiReply(payload);

      expect(result).toEqual(mockResponse);
      expect(axios.post).toHaveBeenCalledWith(
        'http://localhost:5000/chat',
        expect.objectContaining({
          health_context: 'Patient has Type 2 diabetes',
        }),
        expect.anything()
      );
    });

    it('should include patient context in request when provided', async () => {
      const mockResponse: AiChatResponse = {
        reply: 'Hello, I see you are 45 years old...',
        chatbot_active: true,
      };

      vi.mocked(axios.post).mockResolvedValueOnce({
        data: mockResponse,
      });

      const payload: AiChatRequest = {
        message: 'What should I do?',
        language: 'en',
        patient_context: {
          name: 'John Doe',
          age: 45,
          sex: 'M',
          diagnosis: {
            diabetes: true,
            hypertension: false,
          },
        },
      };

      const result = await requestAiReply(payload);

      expect(result).toEqual(mockResponse);
      expect(axios.post).toHaveBeenCalledWith(
        'http://localhost:5000/chat',
        expect.objectContaining({
          patient_context: payload.patient_context,
        }),
        expect.anything()
      );
    });

    it('should use default timeout when AI_SERVICE_TIMEOUT_MS is not set', async () => {
      delete process.env.AI_SERVICE_TIMEOUT_MS;

      const mockResponse: AiChatResponse = {
        reply: 'Response',
        chatbot_active: true,
      };

      vi.mocked(axios.post).mockResolvedValueOnce({
        data: mockResponse,
      });

      const payload: AiChatRequest = {
        message: 'Hello',
      };

      await requestAiReply(payload);

      expect(axios.post).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          timeout: 60000, // Default from code
        })
      );
    });

    it('should throw error when AI_SERVICE_URL is not set', async () => {
      delete process.env.AI_SERVICE_URL;

      const payload: AiChatRequest = {
        message: 'Hello',
      };

      await expect(requestAiReply(payload)).rejects.toThrow(
        'Missing AI_SERVICE_URL or AI_SERVICE_KEY'
      );
    });

    it('should throw error when AI_SERVICE_KEY is not set', async () => {
      delete process.env.AI_SERVICE_KEY;

      const payload: AiChatRequest = {
        message: 'Hello',
      };

      await expect(requestAiReply(payload)).rejects.toThrow(
        'Missing AI_SERVICE_URL or AI_SERVICE_KEY'
      );
    });

    it('should propagate axios errors', async () => {
      const axiosError = new Error('Network error');

      vi.mocked(axios.post).mockRejectedValueOnce(axiosError);

      const payload: AiChatRequest = {
        message: 'Hello',
      };

      await expect(requestAiReply(payload)).rejects.toThrow('Network error');
    });

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('timeout of 5000ms exceeded');

      vi.mocked(axios.post).mockRejectedValueOnce(timeoutError);

      const payload: AiChatRequest = {
        message: 'Hello',
      };

      await expect(requestAiReply(payload)).rejects.toThrow('timeout');
    });

    it('should handle requests with only required message field', async () => {
      const mockResponse: AiChatResponse = {
        reply: 'Response',
        chatbot_active: true,
      };

      vi.mocked(axios.post).mockResolvedValueOnce({
        data: mockResponse,
      });

      const payload: AiChatRequest = {
        message: 'Simple message',
      };

      const result = await requestAiReply(payload);

      expect(result).toEqual(mockResponse);
      expect(axios.post).toHaveBeenCalledWith(
        'http://localhost:5000/chat',
        expect.objectContaining({
          message: 'Simple message',
        }),
        expect.anything()
      );
    });

    it('should set correct headers for the request', async () => {
      const mockResponse: AiChatResponse = {
        reply: 'Response',
        chatbot_active: false,
      };

      vi.mocked(axios.post).mockResolvedValueOnce({
        data: mockResponse,
      });

      const payload: AiChatRequest = {
        message: 'Test',
      };

      await requestAiReply(payload);

      expect(axios.post).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          headers: {
            'x-service-key': 'test-api-key',
            'content-type': 'application/json',
          },
        })
      );
    });

    it('should use the correct endpoint URL', async () => {
      const mockResponse: AiChatResponse = {
        reply: 'Response',
        chatbot_active: true,
      };

      vi.mocked(axios.post).mockResolvedValueOnce({
        data: mockResponse,
      });

      const payload: AiChatRequest = {
        message: 'Test',
      };

      await requestAiReply(payload);

      expect(axios.post).toHaveBeenCalledWith(
        'http://localhost:5000/chat',
        expect.anything(),
        expect.anything()
      );
    });

    it('should handle custom AI_SERVICE_URL', async () => {
      process.env.AI_SERVICE_URL = 'http://custom-ai-service:8080';

      const mockResponse: AiChatResponse = {
        reply: 'Response',
        chatbot_active: true,
      };

      vi.mocked(axios.post).mockResolvedValueOnce({
        data: mockResponse,
      });

      const payload: AiChatRequest = {
        message: 'Test',
      };

      await requestAiReply(payload);

      expect(axios.post).toHaveBeenCalledWith(
        'http://custom-ai-service:8080/chat',
        expect.anything(),
        expect.anything()
      );
    });

    it('should handle custom timeout setting', async () => {
      process.env.AI_SERVICE_TIMEOUT_MS = '120000';

      const mockResponse: AiChatResponse = {
        reply: 'Response',
        chatbot_active: true,
      };

      vi.mocked(axios.post).mockResolvedValueOnce({
        data: mockResponse,
      });

      const payload: AiChatRequest = {
        message: 'Test',
      };

      await requestAiReply(payload);

      expect(axios.post).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          timeout: 120000,
        })
      );
    });
  });
});
