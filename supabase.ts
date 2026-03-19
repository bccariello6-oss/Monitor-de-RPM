import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zpanblqzgrtdfxyvgtou.supabase.co';
const supabaseAnonKey = 'sb_publishable_r92jt3tboGglBsVRfeIOUw_6aLal73U';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
