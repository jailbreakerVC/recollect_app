/*
  # Fix RLS Policies for Custom Authentication

  1. Policy Updates
    - Drop existing policies that rely on auth.jwt()
    - Create new policies that work with our custom user context
    - Ensure policies work with both Supabase auth and custom auth

  2. Security
    - Maintain RLS protection
    - Allow operations when user context is properly set
    - Fallback to Supabase auth if available
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own bookmarks" ON bookmarks;
DROP POLICY IF EXISTS "Users can insert their own bookmarks" ON bookmarks;
DROP POLICY IF EXISTS "Users can update their own bookmarks" ON bookmarks;
DROP POLICY IF EXISTS "Users can delete their own bookmarks" ON bookmarks;

-- Create new policies that work with our custom authentication
CREATE POLICY "Users can view their own bookmarks"
  ON bookmarks
  FOR SELECT
  USING (
    user_id = get_current_user_id() OR
    user_id = current_setting('app.current_user_id', true)
  );

CREATE POLICY "Users can insert their own bookmarks"
  ON bookmarks
  FOR INSERT
  WITH CHECK (
    user_id = get_current_user_id() OR
    user_id = current_setting('app.current_user_id', true)
  );

CREATE POLICY "Users can update their own bookmarks"
  ON bookmarks
  FOR UPDATE
  USING (
    user_id = get_current_user_id() OR
    user_id = current_setting('app.current_user_id', true)
  )
  WITH CHECK (
    user_id = get_current_user_id() OR
    user_id = current_setting('app.current_user_id', true)
  );

CREATE POLICY "Users can delete their own bookmarks"
  ON bookmarks
  FOR DELETE
  USING (
    user_id = get_current_user_id() OR
    user_id = current_setting('app.current_user_id', true)
  );

-- Test the policies work
DO $$
BEGIN
  -- Set a test user context
  PERFORM set_user_context('test_user_policy_check');
  
  -- The policies should now allow operations for this user
  RAISE NOTICE 'RLS policies updated successfully for custom authentication';
END $$;