import { Request, Response } from 'express';
import { supabase } from '../../config/db';
import { v4 as uuidv4 } from 'uuid';

export const getChatSession = async (req: Request, res: Response) => {
  try {
    const patientId = req.params.patientId || (req as any).user?.patient_id;

    if (!patientId) {
      return res.status(400).json({
        success: false,
        message: 'Patient ID is required',
      });
    }

    // Check if a chat session exists for this patient
    let { data: existingSession, error: fetchError } = await supabase
      .from('ChatSession')
      .select('*')
      .eq('patient_id', patientId)
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    // If no session exists, create a new one
    if (fetchError || !existingSession) {
      const newSessionId = uuidv4();
      const { data: newSession, error: createError } = await supabase
        .from('ChatSession')
        .insert({
          chat_id: newSessionId,
          patient_id: patientId,
          language: null,
        })
        .select()
        .single();

      if (createError) throw createError;

      // Add initial chatbot message
      await supabase.from('ChatMessages').insert({
        message_id: uuidv4(),
        chat_id: newSessionId,
        role: 'chatbot',
        content: 'What language do you understand best?',
      });

      // Fetch the session with messages
      const { data: sessionWithMessages, error: fetchWithMessagesError } = await supabase
        .from('ChatSession')
        .select('*, ChatMessages(*)')
        .eq('chat_id', newSessionId)
        .single();

      if (fetchWithMessagesError) throw fetchWithMessagesError;

      return res.status(200).json({
        success: true,
        data: {
          id: sessionWithMessages.chat_id,
          patientId: sessionWithMessages.patient_id,
          language: sessionWithMessages.language,
          startedAt: sessionWithMessages.started_at,
          lastMessageAt: sessionWithMessages.last_message_at,
          chatbotActive: sessionWithMessages.chatbot_active,
          messages: (sessionWithMessages.ChatMessages || []).map((msg: any) => ({
            id: msg.message_id,
            chatId: msg.chat_id,
            role: msg.role,
            content: msg.content,
            createdAt: msg.created_at,
            senderId: msg.sender_id,
          })),
        },
      });
    }

    // Fetch existing session with messages
    const { data: sessionWithMessages, error: fetchWithMessagesError } = await supabase
      .from('ChatSession')
      .select('*, ChatMessages(*)')
      .eq('chat_id', existingSession.chat_id)
      .single();

    if (fetchWithMessagesError) throw fetchWithMessagesError;

    return res.status(200).json({
      success: true,
      data: {
        id: sessionWithMessages.chat_id,
        patientId: sessionWithMessages.patient_id,
        language: sessionWithMessages.language,
        startedAt: sessionWithMessages.started_at,
        lastMessageAt: sessionWithMessages.last_message_at,
        chatbotActive: sessionWithMessages.chatbot_active,
        messages: (sessionWithMessages.ChatMessages || []).map((msg: any) => ({
          id: msg.message_id,
          chatId: msg.chat_id,
          role: msg.role,
          content: msg.content,
          createdAt: msg.created_at,
          senderId: msg.sender_id,
        })),
      },
    });
  } catch (error) {
    console.error('[getChatSession error]', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get or create chat session',
    });
  }
};
