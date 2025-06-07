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

console.log('🚀 Initializing Supabase client with current v2 API...');

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 5, // Conservative rate limiting
    },
    heartbeatIntervalMs: 30000, // 30 seconds
    reconnectAfterMs: (tries: number) => Math.min(tries * 2000, 30000), // Exponential backoff up to 30s
    timeout: 20000, // 20 second timeout
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

// Connection monitoring state
let globalConnectionRetries = 0;
const maxGlobalRetries = 3; // Reduced from 5
let connectionMonitoringActive = false;
let monitorChannel: any = null;
let reconnectionTimeout: NodeJS.Timeout | null = null;

// Monitor realtime connection status using current v2 API
const monitorConnection = () => {
  if (connectionMonitoringActive) {
    console.log('🔍 Connection monitoring already active, skipping...');
    return;
  }
  
  console.log('🔍 Setting up realtime connection monitoring with v2 API...');
  connectionMonitoringActive = true;
  
  // Create a monitoring channel to track connection state
  monitorChannel = supabase.channel('connection-monitor', {
    config: {
      broadcast: { self: false },
      presence: { key: 'monitor' }
    }
  });

  monitorChannel
    .subscribe((status: string, err?: any) => {
      console.log('📡 Connection monitor status changed:', {
        status: status,
        error: err,
        timestamp: new Date().toISOString(),
        retries: globalConnectionRetries
      });
      
      switch (status) {
        case 'SUBSCRIBED':
          console.log('✅ Realtime connection established successfully');
          globalConnectionRetries = 0; // Reset retry counter on successful connection
          // Clear any pending reconnection attempts
          if (reconnectionTimeout) {
            clearTimeout(reconnectionTimeout);
            reconnectionTimeout = null;
          }
          break;
          
        case 'CHANNEL_ERROR':
          console.error('❌ Realtime channel error occurred:', err);
          // Don't auto-reconnect on channel errors - let user manually reconnect
          break;
          
        case 'TIMED_OUT':
          console.warn('⏰ Realtime connection timed out');
          // Don't auto-reconnect on timeout - let user manually reconnect
          break;
          
        case 'CLOSED':
          console.warn('🔒 Realtime connection closed');
          // Only auto-reconnect if this wasn't a manual disconnection
          if (connectionMonitoringActive && globalConnectionRetries === 0) {
            handleConnectionClosed();
          }
          break;
          
        case 'CONNECTING':
          console.log('🔄 Realtime connection attempting...');
          break;
          
        default:
          console.log('🔄 Realtime connection status:', status);
      }
    });
};

const handleConnectionClosed = () => {
  console.warn('🔒 Realtime connection closed unexpectedly:', {
    retries: globalConnectionRetries,
    timestamp: new Date().toISOString()
  });
  
  // Only attempt reconnection if we haven't exceeded max retries
  if (globalConnectionRetries < maxGlobalRetries) {
    attemptReconnection('closed');
  } else {
    console.error('❌ Max reconnection attempts reached. Manual reconnection required.');
    connectionMonitoringActive = false;
  }
};

const attemptReconnection = (reason: string) => {
  if (globalConnectionRetries >= maxGlobalRetries) {
    console.error('❌ Max reconnection attempts reached. Realtime features may be unavailable.');
    console.error('💡 Try using the reconnect button or refresh the page.');
    connectionMonitoringActive = false;
    return;
  }

  globalConnectionRetries++;
  const delay = Math.min(globalConnectionRetries * 5000, 30000); // 5s, 10s, 15s, max 30s
  
  console.log(`🔄 Attempting to reconnect due to ${reason} in ${delay}ms (attempt ${globalConnectionRetries}/${maxGlobalRetries})`);
  
  // Clear any existing timeout
  if (reconnectionTimeout) {
    clearTimeout(reconnectionTimeout);
  }
  
  reconnectionTimeout = setTimeout(() => {
    console.log('🔄 Executing reconnection attempt...');
    reconnectionTimeout = null;
    
    // Clean up current monitor before reconnecting
    if (monitorChannel) {
      console.log('🧹 Cleaning up existing monitor channel...');
      supabase.removeChannel(monitorChannel);
      monitorChannel = null;
    }
    
    connectionMonitoringActive = false;
    
    // Restart monitoring
    setTimeout(() => {
      monitorConnection();
    }, 1000);
  }, delay);
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
  // Get the first channel's state as a proxy for overall connection status
  const channels = supabase.getChannels();
  const state = channels.length > 0 ? channels[0].state : 'disconnected';
  console.log('📊 Current realtime connection state:', {
    state: state,
    channelCount: channels.length,
    channels: channels.map(c => ({ topic: c.topic, state: c.state }))
  });
  return state;
};

// Export a helper function to manually reconnect
export const reconnectRealtime = () => {
  console.log('🔄 Manual realtime reconnection requested...');
  
  // Clear any pending automatic reconnection
  if (reconnectionTimeout) {
    console.log('🧹 Clearing pending reconnection timeout...');
    clearTimeout(reconnectionTimeout);
    reconnectionTimeout = null;
  }
  
  // Reset retry counter for manual reconnection
  globalConnectionRetries = 0;
  
  try {
    // Remove all existing channels
    const channels = supabase.getChannels();
    console.log(`🧹 Removing ${channels.length} existing channels before reconnect...`);
    
    channels.forEach(channel => {
      console.log(`🗑️ Removing channel: ${channel.topic}`);
      supabase.removeChannel(channel);
    });
    
    // Clean up monitor channel reference
    monitorChannel = null;
    
    console.log('✅ All channels removed, ready for fresh connections');
    
    // Reset connection monitoring
    connectionMonitoringActive = false;
    
    // Restart monitoring after a brief delay
    setTimeout(() => {
      console.log('🔄 Restarting connection monitoring...');
      monitorConnection();
    }, 2000); // Increased delay to prevent rapid cycling
    
  } catch (error) {
    console.error('❌ Error during manual reconnection:', {
      error: error,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Export helper to get detailed connection info
export const getDetailedConnectionInfo = () => {
  const channels = supabase.getChannels();
  return {
    channelCount: channels.length,
    channels: channels.map(c => ({
      topic: c.topic,
      state: c.state,
      joinRef: c.joinRef
    })),
    retries: globalConnectionRetries,
    maxRetries: maxGlobalRetries,
    monitoringActive: connectionMonitoringActive,
    hasPendingReconnection: !!reconnectionTimeout
  };
};

// Export function to stop all reconnection attempts
export const stopReconnectionAttempts = () => {
  console.log('🛑 Stopping all reconnection attempts...');
  
  if (reconnectionTimeout) {
    clearTimeout(reconnectionTimeout);
    reconnectionTimeout = null;
  }
  
  connectionMonitoringActive = false;
  globalConnectionRetries = maxGlobalRetries; // Set to max to prevent further attempts
  
  console.log('✅ Reconnection attempts stopped');
};