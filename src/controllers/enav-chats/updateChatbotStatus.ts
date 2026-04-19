import { Request, Response } from 'express';
import { supabase } from '../../config/db';

export const updateChatbotStatus = async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    const { chatbot_active } = req.body;

    console.log('Updating chatbot_active to:', chatbot_active);

    if (chatbot_active === undefined) {
      return res.status(400).json({
        success: false,
        message: 'chatbot_active is required',
      });
    }

    const { data, error } = await supabase
      .from('ChatSession')
      .update({ chatbot_active })
      .eq('chat_id', chatId)
      .select()
      .single();

    if (error) throw error;

    console.log('Updated row:', data);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    console.error('Error updating chatbot status:', err);

    return res.status(500).json({
      success: false,
      message: 'Failed to update chatbot status',
    });
  }
};
