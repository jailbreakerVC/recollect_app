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

// Helper function to create a custom JWT token for RLS
export const createCustomToken = (userId: string) => {
  console.log('🔐 Creating custom token for user:', userId);
  
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
  
  const token = `${header}.${payload}.signature`;
  console.log('✅ Custom token created:', {
    userId: userId,
    tokenLength: token.length,
    tokenPrefix: token.substring(0, 50) + '...'
  });
  
  return token;
};

// Set custom auth context for RLS
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
  } else {
    console.log('✅ RPC functions are available:', {
      currentUserId: data,
      timestamp: new Date().toISOString()
    });
  }
}).catch(err => {
  console.warn('⚠️ RPC test threw exception:', err);
});