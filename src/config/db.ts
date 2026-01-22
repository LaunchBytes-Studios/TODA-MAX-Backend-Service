import { createClient } from '@supabase/supabase-js';

require('dotenv').config();

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL! as string,
  process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY! as string,
);
