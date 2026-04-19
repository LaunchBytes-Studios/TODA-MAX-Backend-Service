import { Request, Response } from 'express';
import { supabase } from '../../config/db';
import { ChatSessionBase } from '../../types/patient-chat';
import { Patient } from '../../types/patient';

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
      .rpc('get_chat_session_with_unread', { p_chat_id: chatId })
      .single<ChatSessionBase>();

    if (error) throw error;

    const { data: patient, error: patientError } = await supabase
      .from('Patient')
      .select('*')
      .eq('patient_id', data.patient_id)
      .single<Patient>();

    if (patientError) throw patientError;

    const formatted = {
      ...data,
      patient: patient ?? null,
    };

    return res.status(200).json({
      success: true,
      data: formatted,
    });
  } catch (err) {
    console.error('Error hydrating session:', err);

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
