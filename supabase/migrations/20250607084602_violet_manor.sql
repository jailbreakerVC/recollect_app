/*
  # Create User Context RPC Functions

  1. Functions
    - `set_user_context(user_id text)` - Sets user context for RLS policies
    - `get_current_user_id()` - Gets current user ID from context or auth

  2. Security
    - Grant execute permissions to anon and authenticated roles
    - Functions are security definer to allow setting configuration
*/

-- Create a function to set user context (for RLS when not using Supabase auth)
CREATE OR REPLACE FUNCTION set_user_context(user_id text)
RETURNS void AS $$
BEGIN
  -- Set a configuration parameter that can be used in RLS policies
  PERFORM set_config('app.current_user_id', user_id, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to get current user context
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS text AS $$
BEGIN
  -- Try to get from Supabase auth first, then fall back to our custom context
  RETURN COALESCE(
    auth.jwt() ->> 'sub',
    current_setting('app.current_user_id', true)
  );
EXCEPTION
  WHEN OTHERS THEN
    -- If current_setting fails (not set), return null
    RETURN auth.jwt() ->> 'sub';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION set_user_context(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_current_user_id() TO anon, authenticated;

-- Test the functions
DO $$
BEGIN
  -- Test setting and getting user context
  PERFORM set_user_context('test_user_123');
  
  IF get_current_user_id() = 'test_user_123' THEN
    RAISE NOTICE 'User context functions created and tested successfully';
  ELSE
    RAISE EXCEPTION 'User context functions test failed';
  END IF;
END $$;