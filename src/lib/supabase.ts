import { createClient } from '@supabase/supabase-js';
import { Logger } from '../utils/logger';

// Environment validation
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

// Create Supabase client with optimized configuration
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  global: {
    headers: {
      'X-Client-Info': 'bookmark-manager-app'
    }
  }
});

// Test connection on module load
supabase
  .from('bookmarks')
  .select('count', { count: 'exact', head: true })
  .then(({ error }) => {
    if (error) {
      Logger.error('Supabase', 'Connection failed', error);
    } else {
      Logger.info('Supabase', 'Connected successfully');
    }
  })
  .catch(err => {
    Logger.error('Supabase', 'Connection error', err);
  });