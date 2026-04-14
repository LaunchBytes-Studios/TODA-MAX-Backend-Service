import { createClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config();

export const supabase = createClient(
  process.env.SUPABASE_URL! as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY! as string,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);
