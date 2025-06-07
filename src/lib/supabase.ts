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

console.log('🚀 Initializing Supabase client (realtime disabled)...');

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // We're handling our own auth
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

// Debug function to help troubleshoot auth issues
export const debugAuthContext = async () => {
  console.log('🔍 Getting auth debug information...');
  
  try {
    const { data, error } = await supabase.rpc('debug_auth_context');
    
    if (error) {
      console.error('❌ Debug auth context failed:', error);
      return { data: null, error };
    }
    
    console.log('🔍 Auth debug info:', data);
    return { data, error: null };
  } catch (err) {
    console.error('❌ Debug auth context exception:', err);
    return { data: null, error: err };
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
  console.warn('⚠️ RPC test threw exception:', {
    error: err,
    message: err.message
  });
});