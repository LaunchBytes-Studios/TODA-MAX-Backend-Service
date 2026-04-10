import { Request, Response } from 'express';
import { supabase } from '../../config/db';
import { v4 as uuidv4 } from 'uuid';

export const setLanguagePreference = async (req: Request, res: Response) => {
  try {
    const { chatId, language } = req.body;

    if (!chatId || !language) {
      return res.status(400).json({
        success: false,
        message: 'Chat ID and language are required',
      });
    }

    // Validate language is one of the accepted values
    const validLanguages = ['english', 'tagalog', 'hiligaynon'];
    if (!validLanguages.includes(language)) {
      return res.status(400).json({
        success: false,
        message: `Language must be one of: ${validLanguages.join(', ')}`,
      });
    }

    // Update chat session with language preference
    const { error: updateError } = await supabase
      .from('ChatSession')
      .update({ language })
      .eq('chat_id', chatId);

    if (updateError) throw updateError;

    // Create a message confirming the language selection
    const { error: messageError } = await supabase.from('ChatMessages').insert({
      message_id: uuidv4(),
      chat_id: chatId,
      role: 'chatbot',
      content: `Great! I'll help you in ${language}.`,
    });

    if (messageError) throw messageError;

    // Fetch the updated session with all messages
    const { data: updatedSession, error: fetchError } = await supabase
      .from('ChatSession')
      .select('*, ChatMessages(*)')
      .eq('chat_id', chatId)
      .single();

    if (fetchError) throw fetchError;

    return res.status(200).json({
      success: true,
      data: {
        id: updatedSession.chat_id,
        patientId: updatedSession.patient_id,
        language: updatedSession.language,
        startedAt: updatedSession.started_at,
        lastMessageAt: updatedSession.last_message_at,
        chatbotActive: updatedSession.chatbot_active,
        messages: (updatedSession.ChatMessages || []).map((msg: any) => ({
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
    console.error('[setLanguagePreference error]', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to set language preference',
    });
  }
};
