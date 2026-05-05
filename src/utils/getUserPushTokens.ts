import { supabase } from '../config/db';

export async function getUserPushTokens(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('UserPushTokens')
    .select('token')
    .eq('user_id', userId);

  if (error || !data) return [];

  return data.map((t) => t.token);
}
