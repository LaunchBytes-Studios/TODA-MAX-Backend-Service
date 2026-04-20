// controllers/patient-chat/streamChatMessages.ts
import { Request, Response } from 'express';
import { supabase } from '../../config/db';
import { createClient } from '@supabase/supabase-js';

export const anonSupabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!, // 👈 change this
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);

export const streamChatMessages = async (req: Request, res: Response) => {
  const { chatId } = req.params;

  // 1. SSE Headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // 2. Heartbeat to prevent connection timeout (every 15s)
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 15000);

  // 3. Subscribe to Supabase Realtime for THIS chat session
  const channel = anonSupabase
    .channel(`realtime_chat_${chatId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'ChatMessages',
      },
      (payload) => {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
        if (payload.eventType === 'INSERT') {
          // Map DB snake_case to Frontend camelCase
          const formattedMessage = {
            id: payload.new.message_id,
            chatId: payload.new.chat_id,
            role: payload.new.role,
            content: payload.new.content,
            createdAt: payload.new.created_at,
            senderId: payload.new.sender_id,
          };

          // Log the message being emitted to SSE
          console.log('[SSE] Emitting message:', formattedMessage);
          // Write to the SSE stream
          res.write(`data: ${JSON.stringify(formattedMessage)}\n\n`);
        }
      },
    )
    .subscribe((status) => {
      console.log('[SSE SUBSCRIBE STATUS]', status);
    });

  // 4. Cleanup when Frontend closes connection
  req.on('close', () => {
    clearInterval(heartbeat);
    anonSupabase.removeChannel(channel);
    res.end();
  });
};
