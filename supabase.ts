import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wchdqdbnfoljsuimkkqr.supabase.co';
const supabaseAnonKey = 'sb_publishable_yUhS9brf95Tu55mnBlJ6cw_twDCyUCj';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
