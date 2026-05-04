import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { Response } from 'express';
import { streamChatMessages } from '../streamChatMessages';
import { supabase } from '../../../config/db';
import { AuthenticatedRequest } from '../../../types/patient-chat';

vi.mock('../../../config/db', () => ({
  supabase: {
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn(),
  },
}));

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
    await streamChatMessages(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    vi.advanceTimersByTime(15000);
    expect(res.write).toHaveBeenCalledWith(': heartbeat\n\n');
  });

  it('should clean up on request close', async () => {
    let closeCallback: CloseCallback = () => {};
    (req.on as Mock<[string, CloseCallback], void>).mockImplementation((event, cb) => {
      if (event === 'close') closeCallback = cb;
    });

    await streamChatMessages(req, res);
    closeCallback();

    expect(supabase.removeChannel).toHaveBeenCalled();
    expect(res.end).toHaveBeenCalled();
  });
});
