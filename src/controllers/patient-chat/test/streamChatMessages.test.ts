import { describe, it, expect, vi, beforeEach } from 'vitest';
import { streamChatMessages } from '../streamChatMessages';
import { supabase } from '../../../config/db';

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
  let req: any;
  let res: any;

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
    let closeCallback: Function = () => {};
    req.on.mockImplementation((event: string, cb: Function) => {
      if (event === 'close') closeCallback = cb;
    });

    await streamChatMessages(req, res);
    closeCallback();

    expect(supabase.removeChannel).toHaveBeenCalled();
    expect(res.end).toHaveBeenCalled();
  });
});
