import { Response } from 'express';
import { supabase } from '../../config/db';
import { randomUUID } from 'crypto';
import { AuthenticatedRequest, ChatMessage } from '../../types/patient-chat';

export const setLanguagePreference = async (req: AuthenticatedRequest, res: Response) => {
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
    const { data: chatbotMessage, error: messageError } = await supabase
      .from('ChatMessages')
      .insert({
        message_id: randomUUID(),
        chat_id: chatId,
        role: 'chatbot',
        content: `Great! I'll help you in ${language}.`,
      })
      .select()
      .single();

    if (messageError) throw messageError;

    const { error: lastMessageError } = await supabase
      .from('ChatSession')
      .update({ last_message_at: chatbotMessage.created_at })
      .eq('chat_id', chatId);

    if (lastMessageError) throw lastMessageError;

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
        chatbotMessage: {
          id: chatbotMessage.message_id,
          chatId: chatbotMessage.chat_id,
          role: chatbotMessage.role,
          content: chatbotMessage.content,
          createdAt: chatbotMessage.created_at,
          senderId: chatbotMessage.sender_id,
        },
        messages: (updatedSession.ChatMessages || []).map((msg: ChatMessage) => ({
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
