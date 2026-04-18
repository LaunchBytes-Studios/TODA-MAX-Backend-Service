import { Request, Response } from 'express';
import { supabase } from '../../config/db';

export const getChatSessionById = async (req: Request, res: Response) => {
  const { chatId } = req.params;

  if (!chatId) {
    return res.status(400).json({
      success: false,
      message: 'chatId is required',
    });
  }

  try {
    const { data, error } = await supabase
      .from('ChatSession')
      .select(
        `
        *,
        patient:Patient (*)
      `,
      )
      .eq('chat_id', chatId)
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    console.error('Error hydrating session:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
