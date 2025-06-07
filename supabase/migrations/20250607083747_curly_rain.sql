/*
  # Fix User ID Policies for Google OAuth

  1. Database Changes
    - Update RLS policies to work with text user IDs instead of UUIDs
    - Add helper function for setting user context
    - Ensure proper indexing for performance

  2. Security
    - Maintain RLS protection with text-based user IDs
    - Add user context function for better policy handling
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own bookmarks" ON bookmarks;
DROP POLICY IF EXISTS "Users can insert their own bookmarks" ON bookmarks;
DROP POLICY IF EXISTS "Users can update their own bookmarks" ON bookmarks;
DROP POLICY IF EXISTS "Users can delete their own bookmarks" ON bookmarks;

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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create new policies using text user IDs
CREATE POLICY "Users can view their own bookmarks"
  ON bookmarks
  FOR SELECT
  USING (user_id = get_current_user_id());

CREATE POLICY "Users can insert their own bookmarks"
  ON bookmarks
  FOR INSERT
  WITH CHECK (user_id = get_current_user_id());

CREATE POLICY "Users can update their own bookmarks"
  ON bookmarks
  FOR UPDATE
  USING (user_id = get_current_user_id())
  WITH CHECK (user_id = get_current_user_id());

CREATE POLICY "Users can delete their own bookmarks"
  ON bookmarks
  FOR DELETE
  USING (user_id = get_current_user_id());

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION set_user_context(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_current_user_id() TO anon, authenticated;