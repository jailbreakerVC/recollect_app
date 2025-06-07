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

console.log('🚀 Initializing Supabase client with config:', {
  url: supabaseUrl,
  keyLength: supabaseAnonKey.length,
  realtime: {
    eventsPerSecond: 10
  },
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
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
  } else {
    console.log('✅ Supabase client initialized and connected successfully:', {
      count: count,
      data: data,
      timestamp: new Date().toISOString()
    });
  }
}).catch(err => {
  console.error('❌ Supabase connection test threw exception:', err);
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

// Set custom auth context for RLS - with fallback for missing functions
export const setAuthContext = async (userId: string) => {
  console.log('🔑 Setting auth context for user:', userId);
  
  try {
    console.log('📞 Calling set_user_context RPC function...');
    
    const { data, error } = await supabase.rpc('set_user_context', { user_id: userId });
    
    if (error) {
      console.error('❌ RPC set_user_context failed:', {
        error: error,
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        userId: userId
      });
      
      // If the function doesn't exist, we'll work without it
      if (error.code === 'PGRST202') {
        console.warn('⚠️ RPC function not found, continuing without user context. RLS policies may not work correctly.');
        return { data: null, error: null }; // Don't treat this as a fatal error
      }
    } else {
      console.log('✅ Auth context set successfully:', {
        userId: userId,
        data: data,
        timestamp: new Date().toISOString()
      });
    }
    
    return { data, error };
  } catch (err) {
    console.error('❌ Exception in setAuthContext:', {
      error: err,
      message: err instanceof Error ? err.message : 'Unknown error',
      userId: userId,
      stack: err instanceof Error ? err.stack : undefined
    });
    
    console.warn('⚠️ RPC set_user_context not available, using direct queries');
    return { data: null, error: null }; // Don't treat this as a fatal error
  }
};

// Test RPC function availability
console.log('🧪 Testing RPC function availability...');
supabase.rpc('get_current_user_id').then(({ data, error }) => {
  if (error) {
    console.warn('⚠️ RPC get_current_user_id test failed:', {
      error: error,
      message: error.message,
      code: error.code
    });
    
    if (error.code === 'PGRST202') {
      console.warn('⚠️ RPC functions not available. You may need to run the migration to create them.');
    }
  } else {
    console.log('✅ RPC functions are available:', {
      currentUserId: data,
      timestamp: new Date().toISOString()
    });
  }
}).catch(err => {
  console.warn('⚠️ RPC test threw exception:', err);
});