import { Request, Response } from 'express';
import { supabase } from '../../config/db';

export const getChatSessionsWithPatients = async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('ChatSession')
      .select(
        `
        chat_id,
        patient_id,
        language,
        started_at,
        last_message_at,
        chatbot_active,
        patient:Patient (
          patient_id,
          firstname,
          surname,
          contact,
          address,
          sex,
          birthday,
          philhealth_num,
          diagnosis,
          avatar_url
        )
      `,
      )
      .order('last_message_at', { ascending: false });

    if (error) throw error;

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    console.error('Error fetching chat sessions:', err);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch chat sessions',
    });
  }
};
