import { Request, Response } from 'express';
import { supabase } from '../../config/db';

export const getMessagesByChatId = async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;

    if (!chatId) {
      return res.status(400).json({
        success: false,
        message: 'chatId is required',
      });
    }

    const { data, error } = await supabase
      .from('ChatMessages')
      .select(
        `
        message_id,
        chat_id,
        role,
        content,
        created_at,
        sender_id
      `,
      )
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true }); // oldest → newest

    if (error) throw error;

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    console.error('Error fetching messages:', err);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch messages',
    });
  }
};
