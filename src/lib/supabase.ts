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

console.log('🚀 Initializing Supabase client with improved realtime config...');

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 5, // Reduced from 10 to be more conservative
    },
    heartbeatIntervalMs: 30000, // 30 seconds
    reconnectAfterMs: (tries: number) => Math.min(tries * 1000, 10000), // Exponential backoff up to 10s
    timeout: 20000, // 20 second timeout
    transport: 'websocket',
    encode: (payload: any, callback: (encoded: string) => void) => {
      console.log('📤 Realtime encode:', payload);
      callback(JSON.stringify(payload));
    },
    decode: (payload: string, callback: (decoded: any) => void) => {
      try {
        const decoded = JSON.parse(payload);
        console.log('📥 Realtime decode:', decoded);
        callback(decoded);
      } catch (error) {
        console.error('❌ Realtime decode error:', error);
        callback({});
      }
    },
    logger: (kind: string, msg: string, data?: any) => {
      if (kind === 'error') {
        console.error(`🔴 Realtime ${kind}:`, msg, data);
      } else if (kind === 'info') {
        console.log(`🔵 Realtime ${kind}:`, msg, data);
      } else {
        console.log(`⚪ Realtime ${kind}:`, msg, data);
      }
    }
  },
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

// Add connection state monitoring
let connectionRetries = 0;
const maxRetries = 5;

// Monitor realtime connection status
const monitorConnection = () => {
  console.log('🔍 Setting up realtime connection monitoring...');
  
  // Listen for connection state changes
  supabase.realtime.onOpen(() => {
    console.log('✅ Realtime WebSocket connection opened successfully');
    connectionRetries = 0; // Reset retry counter on successful connection
  });

  supabase.realtime.onClose((event) => {
    console.warn('⚠️ Realtime WebSocket connection closed:', {
      code: event?.code,
      reason: event?.reason,
      wasClean: event?.wasClean,
      retries: connectionRetries
    });
    
    // Attempt to reconnect if we haven't exceeded max retries
    if (connectionRetries < maxRetries) {
      connectionRetries++;
      const delay = Math.min(connectionRetries * 2000, 10000); // Exponential backoff
      console.log(`🔄 Attempting to reconnect in ${delay}ms (attempt ${connectionRetries}/${maxRetries})`);
      
      setTimeout(() => {
        console.log('🔄 Attempting realtime reconnection...');
        supabase.realtime.connect();
      }, delay);
    } else {
      console.error('❌ Max reconnection attempts reached. Realtime features may be unavailable.');
    }
  });

  supabase.realtime.onError((error) => {
    console.error('❌ Realtime WebSocket error:', {
      error: error,
      message: error?.message,
      type: error?.type,
      retries: connectionRetries
    });
  });
};

// Initialize connection monitoring
monitorConnection();

// Test connection on initialization with better error handling
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

// Test RPC function availability with better error handling
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

// Export a helper function to check connection status
export const getConnectionStatus = () => {
  const state = supabase.realtime.channels[0]?.state || 'disconnected';
  console.log('📊 Current realtime connection state:', state);
  return state;
};

// Export a helper function to manually reconnect
export const reconnectRealtime = () => {
  console.log('🔄 Manual realtime reconnection requested...');
  connectionRetries = 0; // Reset retry counter
  supabase.realtime.disconnect();
  setTimeout(() => {
    supabase.realtime.connect();
  }, 1000);
};