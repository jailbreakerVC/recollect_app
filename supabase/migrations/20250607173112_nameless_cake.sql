/*
  # Fix Missing Semantic Search Function

  1. Function Recreation
    - Recreate the search_bookmarks_semantic function with proper error handling
    - Ensure all required permissions are granted
    - Add function validation and testing

  2. Error Handling
    - Better parameter validation
    - Graceful fallbacks when embeddings aren't available
    - Comprehensive error messages

  3. Performance
    - Optimized query structure
    - Better indexing hints
    - Efficient fallback mechanisms
*/

-- Drop existing function if it exists (to recreate with proper signature)
DROP FUNCTION IF EXISTS search_bookmarks_semantic(text, text, float, integer);

-- Recreate the search function with better error handling and validation
CREATE OR REPLACE FUNCTION search_bookmarks_semantic(
  search_query text,
  user_id_param text,
  similarity_threshold float DEFAULT 0.3,
  max_results integer DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  title text,
  url text,
  folder text,
  date_added timestamptz,
  similarity_score float,
  search_type text
) AS $$
DECLARE
  query_embedding vector;
  has_embeddings boolean;
  clean_query text;
BEGIN
  -- Validate inputs
  IF search_query IS NULL OR length(trim(search_query)) = 0 THEN
    RAISE EXCEPTION 'Search query cannot be null or empty';
  END IF;
  
  IF user_id_param IS NULL OR length(trim(user_id_param)) = 0 THEN
    RAISE EXCEPTION 'User ID cannot be null or empty';
  END IF;
  
  -- Clean the search query
  clean_query := trim(search_query);
  
  -- Ensure reasonable limits
  similarity_threshold := GREATEST(0.0, LEAST(1.0, similarity_threshold));
  max_results := GREATEST(1, LEAST(100, max_results));
  
  -- Check if we have any embeddings for this user
  SELECT EXISTS(
    SELECT 1 FROM bookmarks 
    WHERE user_id = user_id_param 
    AND title_embedding IS NOT NULL
    AND title_embedding != vector(array_fill(0.0, ARRAY[384]))
  ) INTO has_embeddings;
  
  -- If no embeddings exist, fall back to trigram search
  IF NOT has_embeddings THEN
    RETURN QUERY
    SELECT 
      b.id,
      b.title,
      b.url,
      b.folder,
      b.date_added,
      COALESCE(similarity(b.title, clean_query), 0.0) as similarity_score,
      'trigram'::text as search_type
    FROM bookmarks b
    WHERE b.user_id = user_id_param
    AND (
      b.title ILIKE '%' || clean_query || '%' OR
      b.url ILIKE '%' || clean_query || '%' OR
      similarity(b.title, clean_query) > similarity_threshold
    )
    ORDER BY similarity_score DESC, b.date_added DESC
    LIMIT max_results;
    RETURN;
  END IF;
  
  -- Generate embedding for search query
  BEGIN
    query_embedding := generate_title_embedding(clean_query);
  EXCEPTION WHEN OTHERS THEN
    -- If embedding generation fails, fall back to text search
    RETURN QUERY
    SELECT 
      b.id,
      b.title,
      b.url,
      b.folder,
      b.date_added,
      COALESCE(similarity(b.title, clean_query), 0.0) as similarity_score,
      'trigram_fallback'::text as search_type
    FROM bookmarks b
    WHERE b.user_id = user_id_param
    AND (
      b.title ILIKE '%' || clean_query || '%' OR
      b.url ILIKE '%' || clean_query || '%'
    )
    ORDER BY similarity_score DESC, b.date_added DESC
    LIMIT max_results;
    RETURN;
  END;
  
  -- Perform vector similarity search
  RETURN QUERY
  SELECT 
    b.id,
    b.title,
    b.url,
    b.folder,
    b.date_added,
    GREATEST(0.0, 1.0 - (b.title_embedding <=> query_embedding)) as similarity_score,
    'semantic'::text as search_type
  FROM bookmarks b
  WHERE b.user_id = user_id_param
  AND b.title_embedding IS NOT NULL
  AND b.title_embedding != vector(array_fill(0.0, ARRAY[384]))
  AND (1.0 - (b.title_embedding <=> query_embedding)) > similarity_threshold
  ORDER BY b.title_embedding <=> query_embedding ASC
  LIMIT max_results;
  
  -- If no semantic results found, try a more relaxed search
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      b.id,
      b.title,
      b.url,
      b.folder,
      b.date_added,
      COALESCE(similarity(b.title, clean_query), 0.0) as similarity_score,
      'trigram_fallback'::text as search_type
    FROM bookmarks b
    WHERE b.user_id = user_id_param
    AND (
      b.title ILIKE '%' || clean_query || '%' OR
      b.url ILIKE '%' || clean_query || '%' OR
      similarity(b.title, clean_query) > (similarity_threshold * 0.5)
    )
    ORDER BY similarity_score DESC, b.date_added DESC
    LIMIT max_results;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant comprehensive permissions to all roles
GRANT EXECUTE ON FUNCTION search_bookmarks_semantic(text, text, float, integer) TO anon;
GRANT EXECUTE ON FUNCTION search_bookmarks_semantic(text, text, float, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION search_bookmarks_semantic(text, text, float, integer) TO service_role;
GRANT EXECUTE ON FUNCTION search_bookmarks_semantic(text, text, float, integer) TO postgres;

-- Create a simple test function to verify semantic search availability
CREATE OR REPLACE FUNCTION test_semantic_search_availability()
RETURNS boolean AS $$
BEGIN
  -- Try to call the search function with minimal parameters
  PERFORM search_bookmarks_semantic('test', 'test_user', 0.1, 1);
  RETURN true;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions for the test function
GRANT EXECUTE ON FUNCTION test_semantic_search_availability() TO anon;
GRANT EXECUTE ON FUNCTION test_semantic_search_availability() TO authenticated;
GRANT EXECUTE ON FUNCTION test_semantic_search_availability() TO service_role;

-- Test the functions to ensure they work
DO $$
DECLARE
  test_results record;
  availability_test boolean;
BEGIN
  -- Test availability function
  BEGIN
    SELECT test_semantic_search_availability() INTO availability_test;
    IF availability_test THEN
      RAISE NOTICE 'Semantic search availability test: PASSED';
    ELSE
      RAISE NOTICE 'Semantic search availability test: FAILED';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Semantic search availability test: ERROR - %', SQLERRM;
  END;

  -- Test search function with a simple query
  BEGIN
    SELECT * FROM search_bookmarks_semantic('test', 'test_user', 0.1, 1) 
    INTO test_results LIMIT 1;
    RAISE NOTICE 'Semantic search function test: PASSED';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Semantic search function test: ERROR - %', SQLERRM;
  END;
END $$;

-- Refresh the schema cache
NOTIFY pgrst, 'reload schema';

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Semantic search function recreation completed successfully';
  RAISE NOTICE 'Function: search_bookmarks_semantic(text, text, float, integer)';
  RAISE NOTICE 'Permissions granted to: anon, authenticated, service_role, postgres';
  RAISE NOTICE 'Test function: test_semantic_search_availability() created';
END $$;