import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { Response } from 'express';
import { AuthenticatedRequest } from '../../../types/patient-chat';

// Mock the Supabase client before importing the controller
const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
};

const mockAnonSupabase = {
  channel: vi.fn(() => mockChannel),
  removeChannel: vi.fn(),
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockAnonSupabase),
}));

// Set environment variables before importing the controller
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';

// Import after mocking and setting env vars
const { streamChatMessages } = await import('../streamChatMessages');

describe('streamChatMessages', () => {
  type CloseCallback = () => void;
  type StreamRequest = Pick<AuthenticatedRequest, 'params'> & {
    on: (event: string, cb: CloseCallback) => void;
  };
  type StreamResponse = Pick<Response, 'writeHead' | 'write' | 'end'>;

  let req: StreamRequest;
  let res: StreamResponse;

  beforeEach(() => {
    req = { params: { chatId: 'chat-123' }, on: vi.fn() };
    res = {
      writeHead: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
    };
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  it('should set SSE headers and start heartbeat', async () => {
    await streamChatMessages(req as AuthenticatedRequest, res as Response);

    expect(res.writeHead).toHaveBeenCalledWith(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    expect(mockAnonSupabase.channel).toHaveBeenCalledWith('realtime_chat_chat-123');
    expect(mockChannel.on).toHaveBeenCalled();
    expect(mockChannel.subscribe).toHaveBeenCalled();

    vi.advanceTimersByTime(15000);
    expect(res.write).toHaveBeenCalledWith(': heartbeat\n\n');
  });

  it('should clean up on request close', async () => {
    let closeCallback: CloseCallback = () => {};
    (req.on as Mock<(event: string, cb: CloseCallback) => void>).mockImplementation((event, cb) => {
      if (event === 'close') closeCallback = cb;
    });

    await streamChatMessages(req as AuthenticatedRequest, res as Response);
    closeCallback();

    expect(mockAnonSupabase.removeChannel).toHaveBeenCalled();
    expect(res.end).toHaveBeenCalled();
  });
});
