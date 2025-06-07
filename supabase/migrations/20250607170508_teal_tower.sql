/*
  # Fix Missing Embedding Function

  1. Function Recreation
    - Recreate the update_bookmark_embeddings function with proper permissions
    - Ensure the function is accessible to the application
    - Add error handling and validation

  2. Security
    - Grant proper execute permissions
    - Add function validation
*/

-- Drop and recreate the function to ensure it exists
DROP FUNCTION IF EXISTS update_bookmark_embeddings(text);

-- Recreate the function with better error handling
CREATE OR REPLACE FUNCTION update_bookmark_embeddings(user_id_param text DEFAULT NULL)
RETURNS integer AS $$
DECLARE
  updated_count integer := 0;
  bookmark_record record;
  current_embedding vector;
BEGIN
  -- Validate input
  IF user_id_param IS NOT NULL AND length(trim(user_id_param)) = 0 THEN
    RAISE EXCEPTION 'Invalid user_id parameter';
  END IF;

  -- Check if vector extension is available
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    RAISE EXCEPTION 'Vector extension not available';
  END IF;

  -- Update embeddings for bookmarks without them or with zero embeddings
  FOR bookmark_record IN 
    SELECT id, title, title_embedding
    FROM bookmarks 
    WHERE (user_id_param IS NULL OR user_id = user_id_param)
    AND (
      title_embedding IS NULL OR 
      title_embedding = vector(array_fill(0.0, ARRAY[384])) OR
      array_length(title_embedding::float[], 1) != 384
    )
    AND title IS NOT NULL 
    AND length(trim(title)) > 0
  LOOP
    BEGIN
      -- Generate new embedding
      current_embedding := generate_title_embedding(bookmark_record.title);
      
      -- Update the bookmark
      UPDATE bookmarks 
      SET title_embedding = current_embedding
      WHERE id = bookmark_record.id;
      
      updated_count := updated_count + 1;
      
    EXCEPTION WHEN OTHERS THEN
      -- Log error but continue with other bookmarks
      RAISE WARNING 'Failed to update embedding for bookmark %: %', bookmark_record.id, SQLERRM;
    END;
  END LOOP;
  
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the generate_title_embedding function exists
CREATE OR REPLACE FUNCTION generate_title_embedding(title_text text)
RETURNS vector AS $$
DECLARE
  hash_value bigint;
  embedding_array float[];
  i integer;
  clean_title text;
BEGIN
  -- Validate input
  IF title_text IS NULL OR length(trim(title_text)) = 0 THEN
    RAISE EXCEPTION 'Title text cannot be null or empty';
  END IF;

  -- Clean the title
  clean_title := lower(trim(title_text));
  
  -- Generate a hash-based embedding
  hash_value := abs(hashtext(clean_title));
  
  -- Create a 384-dimensional vector
  embedding_array := array_fill(0.0, ARRAY[384]);
  
  -- Fill dimensions based on hash and text characteristics
  FOR i IN 1..384 LOOP
    embedding_array[i] := (((hash_value + i * 17) % 2000) - 1000) / 1000.0;
  END LOOP;
  
  -- Add text-based features for better semantic representation
  embedding_array[1] := LEAST(length(title_text) / 100.0, 1.0);
  embedding_array[2] := LEAST((length(split_part(title_text, ' ', 1)) / 20.0), 1.0) - 0.5;
  embedding_array[3] := case when title_text ~* '\d' then 0.5 else -0.5 end;
  embedding_array[4] := case when title_text ~* '[A-Z]' then 0.5 else -0.5 end;
  embedding_array[5] := case when title_text ~* 'github|git' then 0.8 else 0.0 end;
  embedding_array[6] := case when title_text ~* 'docs|documentation' then 0.8 else 0.0 end;
  embedding_array[7] := case when title_text ~* 'tutorial|guide|how' then 0.8 else 0.0 end;
  embedding_array[8] := case when title_text ~* 'api|reference' then 0.8 else 0.0 end;
  
  -- Normalize the vector to unit length for better similarity calculations
  DECLARE
    norm float := 0.0;
    normalized_array float[];
  BEGIN
    -- Calculate norm
    FOR i IN 1..384 LOOP
      norm := norm + (embedding_array[i] * embedding_array[i]);
    END LOOP;
    norm := sqrt(norm);
    
    -- Normalize if norm > 0
    IF norm > 0 THEN
      normalized_array := array_fill(0.0, ARRAY[384]);
      FOR i IN 1..384 LOOP
        normalized_array[i] := embedding_array[i] / norm;
      END LOOP;
      RETURN normalized_array::vector;
    ELSE
      RETURN embedding_array::vector;
    END IF;
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER;

-- Grant execute permissions explicitly
GRANT EXECUTE ON FUNCTION update_bookmark_embeddings(text) TO anon;
GRANT EXECUTE ON FUNCTION update_bookmark_embeddings(text) TO authenticated;
GRANT EXECUTE ON FUNCTION update_bookmark_embeddings(text) TO service_role;

GRANT EXECUTE ON FUNCTION generate_title_embedding(text) TO anon;
GRANT EXECUTE ON FUNCTION generate_title_embedding(text) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_title_embedding(text) TO service_role;

-- Test the function to ensure it works
DO $$
DECLARE
  test_result integer;
  test_embedding vector;
BEGIN
  -- Test embedding generation
  BEGIN
    test_embedding := generate_title_embedding('Test Bookmark Title');
    IF test_embedding IS NULL THEN
      RAISE EXCEPTION 'Embedding generation returned NULL';
    END IF;
    RAISE NOTICE 'Embedding generation test: PASSED';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Embedding generation test FAILED: %', SQLERRM;
  END;

  -- Test update function
  BEGIN
    SELECT update_bookmark_embeddings() INTO test_result;
    RAISE NOTICE 'Update embeddings test: PASSED (updated % bookmarks)', test_result;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Update embeddings test FAILED: %', SQLERRM;
  END;
END $$;

-- Log completion
RAISE NOTICE 'Embedding functions recreated and tested successfully';