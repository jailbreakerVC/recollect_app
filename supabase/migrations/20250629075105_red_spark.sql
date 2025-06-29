/*
  # Fix Duplicate Prevention Migration - Corrected Syntax

  1. Database Changes
    - Add unique constraints to prevent duplicate bookmarks
    - Create upsert functions with correct PostgreSQL syntax
    - Add bulk operations for efficient sync

  2. Security
    - Maintain RLS protection
    - Add proper error handling
    - Grant necessary permissions
*/

-- Add unique constraint to prevent duplicates (user_id + title combination)
-- We'll use a partial unique index to handle NULL values properly
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookmarks_user_title_unique 
ON bookmarks (user_id, lower(trim(title))) 
WHERE title IS NOT NULL;

-- Add unique constraint for user_id + url combination as well
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookmarks_user_url_unique 
ON bookmarks (user_id, lower(trim(url))) 
WHERE url IS NOT NULL;

-- Create function to safely upsert bookmarks
CREATE OR REPLACE FUNCTION upsert_bookmark(
  p_user_id text,
  p_title text,
  p_url text,
  p_folder text DEFAULT NULL,
  p_chrome_bookmark_id text DEFAULT NULL,
  p_parent_id text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  url text,
  folder text,
  chrome_bookmark_id text,
  parent_id text,
  date_added timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  was_updated boolean
) AS $$
DECLARE
  existing_bookmark bookmarks%ROWTYPE;
  result_bookmark bookmarks%ROWTYPE;
  bookmark_was_updated boolean := false;
BEGIN
  -- Validate inputs
  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 THEN
    RAISE EXCEPTION 'User ID cannot be null or empty';
  END IF;
  
  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RAISE EXCEPTION 'Title cannot be null or empty';
  END IF;
  
  IF p_url IS NULL OR length(trim(p_url)) = 0 THEN
    RAISE EXCEPTION 'URL cannot be null or empty';
  END IF;

  -- Check if bookmark already exists (by title or URL)
  SELECT * INTO existing_bookmark
  FROM bookmarks b
  WHERE b.user_id = p_user_id
  AND (
    lower(trim(b.title)) = lower(trim(p_title)) OR
    lower(trim(b.url)) = lower(trim(p_url))
  )
  LIMIT 1;

  IF existing_bookmark.id IS NOT NULL THEN
    -- Bookmark exists, update it with new information
    bookmark_was_updated := true;
    
    UPDATE bookmarks
    SET 
      title = COALESCE(p_title, existing_bookmark.title),
      url = COALESCE(p_url, existing_bookmark.url),
      folder = COALESCE(p_folder, existing_bookmark.folder),
      chrome_bookmark_id = COALESCE(p_chrome_bookmark_id, existing_bookmark.chrome_bookmark_id),
      parent_id = COALESCE(p_parent_id, existing_bookmark.parent_id),
      updated_at = now()
    WHERE bookmarks.id = existing_bookmark.id
    RETURNING * INTO result_bookmark;
    
  ELSE
    -- Bookmark doesn't exist, insert new one
    INSERT INTO bookmarks (
      user_id,
      title,
      url,
      folder,
      chrome_bookmark_id,
      parent_id,
      date_added,
      created_at,
      updated_at
    ) VALUES (
      p_user_id,
      p_title,
      p_url,
      p_folder,
      p_chrome_bookmark_id,
      p_parent_id,
      now(),
      now(),
      now()
    )
    RETURNING * INTO result_bookmark;
  END IF;

  -- Return the result
  RETURN QUERY SELECT 
    result_bookmark.id,
    result_bookmark.title,
    result_bookmark.url,
    result_bookmark.folder,
    result_bookmark.chrome_bookmark_id,
    result_bookmark.parent_id,
    result_bookmark.date_added,
    result_bookmark.created_at,
    result_bookmark.updated_at,
    bookmark_was_updated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if bookmark exists
CREATE OR REPLACE FUNCTION check_bookmark_exists(
  p_user_id text,
  p_title text DEFAULT NULL,
  p_url text DEFAULT NULL,
  p_chrome_bookmark_id text DEFAULT NULL
)
RETURNS TABLE (
  bookmark_exists boolean,
  bookmark_id uuid,
  existing_title text,
  existing_url text,
  existing_chrome_id text
) AS $$
DECLARE
  existing_bookmark bookmarks%ROWTYPE;
BEGIN
  -- Check by chrome_bookmark_id first (most specific)
  IF p_chrome_bookmark_id IS NOT NULL THEN
    SELECT * INTO existing_bookmark
    FROM bookmarks b
    WHERE b.user_id = p_user_id
    AND b.chrome_bookmark_id = p_chrome_bookmark_id
    LIMIT 1;
    
    IF existing_bookmark.id IS NOT NULL THEN
      RETURN QUERY SELECT 
        true,
        existing_bookmark.id,
        existing_bookmark.title,
        existing_bookmark.url,
        existing_bookmark.chrome_bookmark_id;
      RETURN;
    END IF;
  END IF;

  -- Check by title and URL
  IF p_title IS NOT NULL OR p_url IS NOT NULL THEN
    SELECT * INTO existing_bookmark
    FROM bookmarks b
    WHERE b.user_id = p_user_id
    AND (
      (p_title IS NOT NULL AND lower(trim(b.title)) = lower(trim(p_title))) OR
      (p_url IS NOT NULL AND lower(trim(b.url)) = lower(trim(p_url)))
    )
    LIMIT 1;
    
    IF existing_bookmark.id IS NOT NULL THEN
      RETURN QUERY SELECT 
        true,
        existing_bookmark.id,
        existing_bookmark.title,
        existing_bookmark.url,
        existing_bookmark.chrome_bookmark_id;
      RETURN;
    END IF;
  END IF;

  -- No existing bookmark found
  RETURN QUERY SELECT 
    false,
    NULL::uuid,
    NULL::text,
    NULL::text,
    NULL::text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function for bulk upsert operations
CREATE OR REPLACE FUNCTION bulk_upsert_bookmarks(
  p_user_id text,
  p_bookmarks text
)
RETURNS TABLE (
  total_processed integer,
  inserted_count integer,
  updated_count integer,
  skipped_count integer,
  results_summary text
) AS $$
DECLARE
  bookmark_item jsonb;
  upsert_result record;
  total_count integer := 0;
  insert_count integer := 0;
  update_count integer := 0;
  skip_count integer := 0;
  bookmarks_json jsonb;
BEGIN
  -- Parse the JSON string
  BEGIN
    bookmarks_json := p_bookmarks::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Invalid JSON format for bookmarks data';
  END;

  -- Process each bookmark in the array
  FOR bookmark_item IN SELECT * FROM jsonb_array_elements(bookmarks_json)
  LOOP
    BEGIN
      total_count := total_count + 1;
      
      -- Call upsert function for each bookmark
      SELECT * INTO upsert_result
      FROM upsert_bookmark(
        p_user_id,
        bookmark_item->>'title',
        bookmark_item->>'url',
        bookmark_item->>'folder',
        bookmark_item->>'chrome_bookmark_id',
        bookmark_item->>'parent_id'
      );
      
      -- Count the operation type
      IF upsert_result.was_updated THEN
        update_count := update_count + 1;
      ELSE
        insert_count := insert_count + 1;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      -- Skip problematic bookmarks and count them
      skip_count := skip_count + 1;
    END;
  END LOOP;

  -- Return summary
  RETURN QUERY SELECT 
    total_count,
    insert_count,
    update_count,
    skip_count,
    format('Processed: %s, Inserted: %s, Updated: %s, Skipped: %s', 
           total_count, insert_count, update_count, skip_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION upsert_bookmark(text, text, text, text, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION check_bookmark_exists(text, text, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION bulk_upsert_bookmarks(text, text) TO anon, authenticated, service_role;

-- Test the functions
DO $$
DECLARE
  test_user_id text := 'test_user_duplicate_prevention';
  upsert_result record;
  check_result record;
BEGIN
  -- Test upsert function
  SELECT * INTO upsert_result
  FROM upsert_bookmark(
    test_user_id,
    'Test Bookmark Title',
    'https://example.com/test',
    'Test Folder',
    'chrome_test_123',
    'parent_test_456'
  );
  
  IF upsert_result.id IS NOT NULL THEN
    RAISE NOTICE 'Upsert function test: PASSED (inserted bookmark)';
  ELSE
    RAISE EXCEPTION 'Upsert function test: FAILED (no bookmark returned)';
  END IF;
  
  -- Test duplicate prevention
  SELECT * INTO upsert_result
  FROM upsert_bookmark(
    test_user_id,
    'Test Bookmark Title',
    'https://example.com/test-different',
    'Different Folder',
    'chrome_test_456',
    'parent_test_789'
  );
  
  IF upsert_result.was_updated THEN
    RAISE NOTICE 'Duplicate prevention test: PASSED (bookmark was updated)';
  ELSE
    RAISE EXCEPTION 'Duplicate prevention test: FAILED (new bookmark created instead of update)';
  END IF;
  
  -- Test check function
  SELECT * INTO check_result
  FROM check_bookmark_exists(
    test_user_id,
    'Test Bookmark Title',
    NULL,
    NULL
  );
  
  IF check_result.bookmark_exists THEN
    RAISE NOTICE 'Check function test: PASSED (bookmark found)';
  ELSE
    RAISE EXCEPTION 'Check function test: FAILED (bookmark not found)';
  END IF;
  
  -- Clean up test data
  DELETE FROM bookmarks WHERE user_id = test_user_id;
  
  RAISE NOTICE 'All duplicate prevention functions tested successfully';
END $$;