import { supabase } from '../config/db';

/**
 * Fetches the first enav_id from the eNavigator table.
 * Throws an error if not found or if there is a DB error.
 */
export const getFirstEnavId = async (): Promise<string> => {
  const { data, error } = await supabase.from('eNavigator').select('enav_id').limit(1);
  if (error || !data || data.length === 0) {
    throw new Error('Error fetching enav_id from eNavigator table.');
  }
  return data[0].enav_id;
};
