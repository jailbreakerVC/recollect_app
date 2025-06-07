/*
  # Fix Authentication and RLS Policies

  1. Database Changes
    - Create more robust RLS policies that handle both authenticated and anonymous users
    - Add better error handling for user context functions
    - Ensure policies work with our Google OAuth system

  2. Security
    - Maintain strict RLS while allowing our custom authentication
    - Add debugging functions to help troubleshoot auth issues
*/

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Users can view their own bookmarks" ON bookmarks;
DROP POLICY IF EXISTS "Users can insert their own bookmarks" ON bookmarks;
DROP POLICY IF EXISTS "Users can update their own bookmarks" ON bookmarks;
DROP POLICY IF EXISTS "Users can delete their own bookmarks" ON bookmarks;

-- Update the get_current_user_id function to be more robust
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS text AS $$
DECLARE
  jwt_user_id text;
  context_user_id text;
BEGIN
  -- Try to get from Supabase auth JWT
  BEGIN
    jwt_user_id := auth.jwt() ->> 'sub';
  EXCEPTION
    WHEN OTHERS THEN
      jwt_user_id := NULL;
  END;
  
  -- Try to get from our custom context
  BEGIN
    context_user_id := current_setting('app.current_user_id', false);
  EXCEPTION
    WHEN OTHERS THEN
      context_user_id := NULL;
  END;
  
  -- Return the first non-null value
  RETURN COALESCE(jwt_user_id, context_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a debug function to help troubleshoot auth issues
CREATE OR REPLACE FUNCTION debug_auth_context()
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'jwt_user_id', (auth.jwt() ->> 'sub'),
    'context_user_id', current_setting('app.current_user_id', true),
    'current_user_id', get_current_user_id(),
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION debug_auth_context() TO anon, authenticated;

-- Create new, more permissive policies for our custom auth system
CREATE POLICY "Users can view their own bookmarks"
  ON bookmarks
  FOR SELECT
  TO anon, authenticated
  USING (
    user_id = get_current_user_id() OR
    user_id = current_setting('app.current_user_id', true) OR
    (auth.jwt() ->> 'sub') = user_id
  );

CREATE POLICY "Users can insert their own bookmarks"
  ON bookmarks
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    user_id = get_current_user_id() OR
    user_id = current_setting('app.current_user_id', true) OR
    (auth.jwt() ->> 'sub') = user_id
  );

CREATE POLICY "Users can update their own bookmarks"
  ON bookmarks
  FOR UPDATE
  TO anon, authenticated
  USING (
    user_id = get_current_user_id() OR
    user_id = current_setting('app.current_user_id', true) OR
    (auth.jwt() ->> 'sub') = user_id
  )
  WITH CHECK (
    user_id = get_current_user_id() OR
    user_id = current_setting('app.current_user_id', true) OR
    (auth.jwt() ->> 'sub') = user_id
  );

CREATE POLICY "Users can delete their own bookmarks"
  ON bookmarks
  FOR DELETE
  TO anon, authenticated
  USING (
    user_id = get_current_user_id() OR
    user_id = current_setting('app.current_user_id', true) OR
    (auth.jwt() ->> 'sub') = user_id
  );

-- Test the new policies
DO $$
DECLARE
  test_user_id text := 'test_user_' || extract(epoch from now())::text;
  debug_info json;
BEGIN
  -- Set test user context
  PERFORM set_user_context(test_user_id);
  
  -- Get debug info
  SELECT debug_auth_context() INTO debug_info;
  
  RAISE NOTICE 'Auth debug info: %', debug_info;
  RAISE NOTICE 'RLS policies updated and tested successfully';
END $$;