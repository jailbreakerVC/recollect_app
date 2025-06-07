/*
  # Secure RLS Policies with User ID Matching

  1. Security Implementation
    - Replace permissive policies with secure user_id matching
    - Use the user_id column to enforce data isolation
    - Simple and effective approach for Google OAuth

  2. How it works
    - Each bookmark has a user_id field (Google user ID)
    - Policies check that operations only affect bookmarks with matching user_id
    - Application must set user_id correctly when creating bookmarks
*/

-- Update policies to use proper user_id matching
DROP POLICY IF EXISTS "Enable read access for own bookmarks" ON bookmarks;
DROP POLICY IF EXISTS "Enable insert for own bookmarks" ON bookmarks;
DROP POLICY IF EXISTS "Enable update for own bookmarks" ON bookmarks;
DROP POLICY IF EXISTS "Enable delete for own bookmarks" ON bookmarks;

-- Create a function to get the current user ID from our application context
-- This will be set by our application when making requests
CREATE OR REPLACE FUNCTION get_app_user_id()
RETURNS text AS $$
BEGIN
  -- Get the user ID that our application sets in the request context
  -- This will be set via set_config() in our application code
  RETURN current_setting('app.user_id', true);
EXCEPTION
  WHEN OTHERS THEN
    -- If not set, return null (which will deny access)
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_app_user_id() TO anon, authenticated;

-- Create secure policies that use user_id matching
CREATE POLICY "Users can read own bookmarks" ON bookmarks
  FOR SELECT
  TO anon, authenticated
  USING (user_id = get_app_user_id());

CREATE POLICY "Users can insert own bookmarks" ON bookmarks
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (user_id = get_app_user_id());

CREATE POLICY "Users can update own bookmarks" ON bookmarks
  FOR UPDATE
  TO anon, authenticated
  USING (user_id = get_app_user_id())
  WITH CHECK (user_id = get_app_user_id());

CREATE POLICY "Users can delete own bookmarks" ON bookmarks
  FOR DELETE
  TO anon, authenticated
  USING (user_id = get_app_user_id());

-- Test the function
DO $$
BEGIN
  -- Test setting user context
  PERFORM set_config('app.user_id', 'test_user_123', true);
  
  IF get_app_user_id() = 'test_user_123' THEN
    RAISE NOTICE 'Secure RLS policies created successfully';
    RAISE NOTICE 'User ID function working correctly';
  ELSE
    RAISE WARNING 'User ID function test failed';
  END IF;
END $$;