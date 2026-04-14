import { Request, Response } from 'express';
import { supabase } from '../../config/db';

export const sendMessage = async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    const { content, senderId } = req.body;

    if (!chatId || !content) {
      return res.status(400).json({
        success: false,
        message: 'chatId and content are required',
      });
    }

    const { data, error } = await supabase
      .from('ChatMessages')
      .insert([
        {
          chat_id: chatId,
          content,
          role: 'enav',
          sender_id: senderId,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    await supabase
      .from('ChatSession')
      .update({ last_message_at: new Date().toISOString() })
      .eq('chat_id', chatId);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    console.error('Error sending message:', err);

    return res.status(500).json({
      success: false,
      message: 'Failed to send message',
    });
  }
};
