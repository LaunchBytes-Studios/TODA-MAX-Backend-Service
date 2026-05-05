import { Request, Response } from 'express';
import { supabase } from '../../config/db';
import { getUserPushTokens } from '../../utils/getUserPushTokens';
import { sendPushNotifications } from '../../utils/sendPushNotifications';

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

    const { data: sessionData } = await supabase
      .from('ChatSession')
      .update({ last_message_at: new Date().toISOString() })
      .eq('chat_id', chatId)
      .select()
      .single();

    const tokens = await getUserPushTokens(sessionData.patient_id);

    if (tokens.length > 0) {
      sendPushNotifications(
        tokens,
        'New message from eNavigator',
        content.length > 80 ? content.slice(0, 80) + '...' : content,
        {
          type: 'chat',
          id: chatId as string,
        },
      ).catch(console.error);
    }

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
