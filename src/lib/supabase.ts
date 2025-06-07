import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('🔧 Supabase Environment Check:', {
  url: supabaseUrl ? '✅ Set' : '❌ Missing',
  urlValue: supabaseUrl,
  key: supabaseAnonKey ? '✅ Set' : '❌ Missing',
  keyLength: supabaseAnonKey?.length || 0,
  keyPrefix: supabaseAnonKey?.substring(0, 20) + '...' || 'N/A'
});

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables:', {
    url: !!supabaseUrl,
    key: !!supabaseAnonKey,
    envVars: Object.keys(import.meta.env).filter(key => key.includes('SUPABASE'))
  });
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

console.log('🚀 Initializing Supabase client (simplified mode)...');

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

// Test connection on initialization
console.log('🔍 Testing Supabase connection...');
supabase.from('bookmarks').select('count', { count: 'exact', head: true }).then(({ data, error, count }) => {
  if (error) {
    console.error('❌ Supabase connection test failed:', {
      error: error,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code
    });
    
    // Provide specific guidance based on error type
    if (error.code === 'PGRST116') {
      console.error('💡 Table "bookmarks" does not exist. Please run the database migrations.');
    } else if (error.message.includes('JWT')) {
      console.error('💡 Authentication issue. Check your Supabase keys and RLS policies.');
    } else if (error.message.includes('network') || error.message.includes('fetch')) {
      console.error('💡 Network connectivity issue. Check your internet connection and Supabase URL.');
    }
  } else {
    console.log('✅ Supabase client initialized and connected successfully:', {
      count: count,
      data: data,
      timestamp: new Date().toISOString()
    });
  }
}).catch(err => {
  console.error('❌ Supabase connection test threw exception:', {
    error: err,
    message: err.message,
    stack: err.stack
  });
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

// Simplified auth context - no longer needed with RLS disabled
export const setAuthContext = async (userId: string) => {
  console.log('🔑 Auth context simplified (RLS disabled):', userId);
  return { data: null, error: null };
};

// Debug function - simplified
export const debugAuthContext = async () => {
  console.log('🔍 Auth debug (RLS disabled)');
  return { data: { mode: 'rls_disabled' }, error: null };
};