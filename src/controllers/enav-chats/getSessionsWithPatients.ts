import { Request, Response } from 'express';
import { supabase } from '../../config/db';
import { ChatSessionBase, ChatSessionWithPatient } from '../../types/patient-chat';
import { Patient } from '../../types/patient';

export const getChatSessionsWithPatients = async (req: Request, res: Response) => {
  try {
    const { data, error } = (await supabase.rpc('get_chat_sessions_with_unread')) as {
      data: ChatSessionBase[] | null;
      error: Error | string | undefined;
    };

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
      });
    }

    const patientIds = [...new Set(data.map((s) => s.patient_id))];

    const { data: patients, error: patientError } = await supabase
      .from('Patient')
      .select('*')
      .in('patient_id', patientIds)
      .returns<Patient[]>();

    if (patientError) throw patientError;

    const patientMap = new Map<string, Patient>((patients ?? []).map((p) => [p.patient_id, p]));

    const formatted: ChatSessionWithPatient[] = data.map((session) => ({
      ...session,
      patient: patientMap.get(session.patient_id) || null,
    }));

    return res.status(200).json({
      success: true,
      data: formatted,
    });
  } catch (err) {
    console.error('Error fetching chat sessions:', err);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch chat sessions',
    });
  }
};
