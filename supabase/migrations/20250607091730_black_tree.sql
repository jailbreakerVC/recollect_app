/*
  # Temporarily disable RLS for testing

  This migration temporarily disables RLS on the bookmarks table to allow
  the application to work while we debug the authentication issues.
  
  WARNING: This removes security restrictions. In production, you should
  re-enable RLS once authentication is properly configured.
*/

-- Temporarily disable RLS on bookmarks table
ALTER TABLE bookmarks DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies since RLS is disabled
DROP POLICY IF EXISTS "Users can view their own bookmarks" ON bookmarks;
DROP POLICY IF EXISTS "Users can insert their own bookmarks" ON bookmarks;
DROP POLICY IF EXISTS "Users can update their own bookmarks" ON bookmarks;
DROP POLICY IF EXISTS "Users can delete their own bookmarks" ON bookmarks;

-- Add a comment to remind us this is temporary
COMMENT ON TABLE bookmarks IS 'RLS temporarily disabled for testing. Re-enable in production with proper auth.';

-- Log the change
DO $$
BEGIN
  RAISE NOTICE 'RLS disabled on bookmarks table for testing purposes';
  RAISE NOTICE 'Remember to re-enable RLS in production with proper authentication';
END $$;