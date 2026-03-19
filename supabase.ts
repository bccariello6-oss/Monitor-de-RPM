import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mhelewhkrscejjvksmyi.supabase.co';
const supabaseAnonKey = 'sb_publishable_KO83njiZO0EDeewRs15sGw_pwnd_VXt';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
