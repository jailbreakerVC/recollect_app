import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables:', {
    url: !!supabaseUrl,
    key: !!supabaseAnonKey
  });
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

console.log('Initializing Supabase client:', {
  url: supabaseUrl,
  keyLength: supabaseAnonKey.length
});

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  auth: {
    persistSession: false, // We're handling our own auth
    autoRefreshToken: false,
  },
});

// Test connection on initialization
supabase.from('bookmarks').select('count', { count: 'exact', head: true }).then(({ error }) => {
  if (error) {
    console.error('Supabase connection test failed:', error);
  } else {
    console.log('Supabase client initialized and connected successfully');
  }
});

export interface DatabaseBookmark {
  id: string;
  user_id: string;
  chrome_bookmark_id?: string;
  title: string;
  url: string;
  folder?: string;
  parent_id?: string;
  date_added: string;
  created_at: string;
  updated_at: string;
}

// Helper function to create a custom JWT token for RLS
export const createCustomToken = (userId: string) => {
  // Create a simple JWT-like structure for RLS
  // In production, this should be done server-side with proper JWT signing
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ 
    sub: userId,
    aud: 'authenticated',
    role: 'authenticated',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour
  }));
  
  return `${header}.${payload}.signature`;
};

// Set custom auth context for RLS
export const setAuthContext = async (userId: string) => {
  try {
    // Set the user context for RLS policies
    const { error } = await supabase.rpc('set_user_context', { user_id: userId });
    if (error) {
      console.warn('Could not set user context:', error);
    }
  } catch (err) {
    console.warn('RPC set_user_context not available, using direct queries');
  }
};