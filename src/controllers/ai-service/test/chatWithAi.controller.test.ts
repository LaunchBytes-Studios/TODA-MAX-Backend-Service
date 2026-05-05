import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response } from 'express';

interface SupabaseQueryMock {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
}

interface SupabaseInsertQueryMock {
  insert: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
}

vi.mock('../../../config/db', () => ({
  supabase: { from: vi.fn() },
}));
vi.mock('../../../services/ai.service', () => ({
  requestAiReply: vi.fn(),
}));
vi.mock('../../../services/healthContent.service', () => ({
  getHealthContext: vi.fn(),
}));
vi.mock('../../../utils/helpers', () => ({
  requirePatientId: vi.fn(),
}));
vi.mock('../sessionHelpers', () => ({
  fetchChatHistory: vi.fn(),
  fetchPatientContext: vi.fn(),
  updateChatSession: vi.fn(),
  assertChatOwnership: vi.fn(),
  createChatSession: vi.fn(),
}));

import { chatWithAi } from '../chatWithAi.controller';
import { supabase } from '../../../config/db';
import { requirePatientId } from '../../../utils/helpers';
import {
  updateChatSession,
  assertChatOwnership,
  createChatSession,
  fetchPatientContext,
} from '../sessionHelpers';

const CHAT_ID = '123e4567-e89b-12d3-a456-426614174000';

describe('chatWithAi', () => {
  let req: Request;
  let res: Partial<Response>;
  let setImmediateSpy: ReturnType<typeof vi.spyOn>;
  let chatSessionQuery: SupabaseQueryMock;
  let chatMessagesQuery: SupabaseInsertQueryMock;

  beforeEach(() => {
    vi.clearAllMocks();

    process.env.CHATBOT_ID = 'chatbot-123';
    process.env.CHATBOT_ACTIVE = 'true';

    req = {
      body: {
        message: 'Hello AI',
        chat_id: CHAT_ID,
        language: 'en',
      },
      headers: {},
    } as unknown as Request;

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    setImmediateSpy = vi
      .spyOn(global, 'setImmediate')
      .mockImplementation(() => ({ _idleTimeout: -1 }) as unknown as NodeJS.Immediate);

    (requirePatientId as ReturnType<typeof vi.fn>).mockReturnValue('patient-123');
    (fetchPatientContext as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (assertChatOwnership as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (updateChatSession as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (createChatSession as ReturnType<typeof vi.fn>).mockResolvedValue('new-chat-456');

    chatSessionQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn(),
    };
    chatMessagesQuery = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn(),
    };

    (
      supabase as unknown as {
        from(table: string): SupabaseQueryMock | SupabaseInsertQueryMock;
      }
    ).from = vi.fn((table: string) => {
      if (table === 'ChatSession') return chatSessionQuery;
      if (table === 'ChatMessages') return chatMessagesQuery;
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  afterEach(() => {
    setImmediateSpy.mockRestore();
    delete process.env.CHATBOT_ID;
    delete process.env.CHATBOT_ACTIVE;
  });

  it('returns 400 when request body is invalid', async () => {
    req.body = { message: 'x' };

    await chatWithAi(req, res as Response);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Invalid request body',
    });
  });

  it('returns success response for existing chat session', async () => {
    chatSessionQuery.single.mockResolvedValue({
      data: { chatbot_active: true },
      error: null,
    });
    chatMessagesQuery.single.mockResolvedValue({
      data: { created_at: new Date().toISOString() },
      error: null,
    });

    await chatWithAi(req, res as Response);

    expect(assertChatOwnership).toHaveBeenCalledWith(CHAT_ID, 'patient-123');
    expect(updateChatSession).toHaveBeenCalledWith(CHAT_ID, { language: 'en' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: {
        chat_id: CHAT_ID,
        reply: null,
        chatbot_active: true,
      },
    });
    expect(setImmediateSpy).toHaveBeenCalled();
  });

  it('creates a new chat session when none exists', async () => {
    req.body = { message: 'Hello AI' };

    chatSessionQuery.single.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'not found' },
    });
    chatMessagesQuery.single.mockResolvedValue({
      data: { created_at: new Date().toISOString() },
      error: null,
    });

    await chatWithAi(req, res as Response);

    expect(createChatSession).toHaveBeenCalledWith('patient-123', undefined);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: {
        chat_id: 'new-chat-456',
        reply: null,
        chatbot_active: true,
      },
    });
    expect(setImmediateSpy).toHaveBeenCalled();
  });

  it('throws when inserting patient message fails', async () => {
    chatSessionQuery.single.mockResolvedValue({
      data: { chatbot_active: true },
      error: null,
    });

    (
      supabase as unknown as {
        from(
          table: string,
        ): SupabaseQueryMock | SupabaseInsertQueryMock | { insert: ReturnType<typeof vi.fn> };
      }
    ).from = vi.fn((table: string) => {
      if (table === 'ChatSession') return chatSessionQuery;
      if (table === 'ChatMessages') {
        return {
          insert: vi.fn().mockResolvedValue({
            error: { message: 'insert failed' },
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    await expect(chatWithAi(req, res as Response)).rejects.toThrow('insert failed');
  });
});
