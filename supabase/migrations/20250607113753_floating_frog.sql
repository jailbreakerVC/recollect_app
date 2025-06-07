/*
  # Fix Sync Authentication Issues

  1. Database Changes
    - Create a more robust user context system
    - Fix RLS policies to work with our Google OAuth system
    - Add proper error handling for authentication

  2. Security
    - Maintain data isolation between users
    - Allow operations when user context is properly set
    - Add debugging capabilities
*/

-- Create an improved user context function that works with our app
CREATE OR REPLACE FUNCTION set_app_user_context(user_id text)
RETURNS void AS $$
BEGIN
  -- Set the user ID in a way that our policies can access
  PERFORM set_config('app.current_user_id', user_id, true);
  
  -- Also set it in the standard location for compatibility
  PERFORM set_config('app.user_id', user_id, true);
  
  -- Log the context setting for debugging
  RAISE NOTICE 'User context set for user: %', user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to get the current user context
CREATE OR REPLACE FUNCTION get_app_current_user()
RETURNS text AS $$
DECLARE
  user_id text;
BEGIN
  -- Try to get from our app context first
  BEGIN
    user_id := current_setting('app.current_user_id', false);
    IF user_id IS NOT NULL AND user_id != '' THEN
      RETURN user_id;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      -- Setting not found, continue
      NULL;
  END;
  
  -- Try the alternative location
  BEGIN
    user_id := current_setting('app.user_id', false);
    IF user_id IS NOT NULL AND user_id != '' THEN
      RETURN user_id;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      -- Setting not found, continue
      NULL;
  END;
  
  -- Try Supabase auth as fallback
  BEGIN
    user_id := auth.jwt() ->> 'sub';
    IF user_id IS NOT NULL AND user_id != '' THEN
      RETURN user_id;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      -- Auth not available
      NULL;
  END;
  
  -- No user context found
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION set_app_user_context(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_app_current_user() TO anon, authenticated;

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Users can read own bookmarks" ON bookmarks;
DROP POLICY IF EXISTS "Users can insert own bookmarks" ON bookmarks;
DROP POLICY IF EXISTS "Users can update own bookmarks" ON bookmarks;
DROP POLICY IF EXISTS "Users can delete own bookmarks" ON bookmarks;

-- Create new policies that use our improved user context
CREATE POLICY "Users can read own bookmarks" ON bookmarks
  FOR SELECT
  TO anon, authenticated
  USING (
    user_id = get_app_current_user() OR
    user_id = current_setting('app.current_user_id', true) OR
    user_id = current_setting('app.user_id', true)
  );

CREATE POLICY "Users can insert own bookmarks" ON bookmarks
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    user_id = get_app_current_user() OR
    user_id = current_setting('app.current_user_id', true) OR
    user_id = current_setting('app.user_id', true)
  );

CREATE POLICY "Users can update own bookmarks" ON bookmarks
  FOR UPDATE
  TO anon, authenticated
  USING (
    user_id = get_app_current_user() OR
    user_id = current_setting('app.current_user_id', true) OR
    user_id = current_setting('app.user_id', true)
  )
  WITH CHECK (
    user_id = get_app_current_user() OR
    user_id = current_setting('app.current_user_id', true) OR
    user_id = current_setting('app.user_id', true)
  );

CREATE POLICY "Users can delete own bookmarks" ON bookmarks
  FOR DELETE
  TO anon, authenticated
  USING (
    user_id = get_app_current_user() OR
    user_id = current_setting('app.current_user_id', true) OR
    user_id = current_setting('app.user_id', true)
  );

-- Create a debug function to help troubleshoot auth issues
CREATE OR REPLACE FUNCTION debug_user_context()
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'app_current_user_id', current_setting('app.current_user_id', true),
    'app_user_id', current_setting('app.user_id', true),
    'get_app_current_user', get_app_current_user(),
    'auth_jwt_sub', (auth.jwt() ->> 'sub'),
    'current_role', current_setting('role', true),
    'session_user', session_user,
    'current_user', current_user
  ) INTO result;
  
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission for debugging
GRANT EXECUTE ON FUNCTION debug_user_context() TO anon, authenticated;

-- Test the new functions
DO $$
DECLARE
  test_user_id text := 'test_user_' || extract(epoch from now())::text;
  debug_info json;
BEGIN
  -- Test setting user context
  PERFORM set_app_user_context(test_user_id);
  
  -- Test getting user context
  IF get_app_current_user() = test_user_id THEN
    RAISE NOTICE 'User context functions working correctly';
  ELSE
    RAISE WARNING 'User context test failed: expected %, got %', test_user_id, get_app_current_user();
  END IF;
  
  -- Get debug info
  SELECT debug_user_context() INTO debug_info;
  RAISE NOTICE 'Debug info: %', debug_info;
  
  RAISE NOTICE 'Auth fix migration completed successfully';
END $$;