/*
  # Enhanced Vector Search Functions

  1. Enhanced Functions
    - `search_bookmarks_vector_enhanced` - Improved vector search with boosting
    - `search_bookmarks_hybrid` - Hybrid semantic + keyword search
    - `search_bookmarks_keywords_enhanced` - Better keyword search with ranking

  2. Performance Improvements
    - Better similarity calculations
    - Recency and frequency boosting
    - Multi-strategy search approach

  3. Search Quality
    - Query preprocessing
    - Result ranking and filtering
    - Fallback mechanisms
*/

-- Enhanced vector search function with boosting
CREATE OR REPLACE FUNCTION search_bookmarks_vector_enhanced(
    query_embedding vector(384),
    user_id_param text,
    similarity_threshold float DEFAULT 0.15,
    max_results int DEFAULT 20,
    boost_recent boolean DEFAULT true,
    boost_frequent boolean DEFAULT false
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
    days_threshold int := 30; -- Consider bookmarks from last 30 days as "recent"
BEGIN
    RETURN QUERY
    SELECT 
        b.id,
        b.title,
        b.url,
        b.folder,
        b.date_added,
        CASE 
            WHEN boost_recent AND b.date_added > (now() - interval '30 days') THEN
                LEAST((1 - (b.title_embedding <=> query_embedding)) * 1.1, 1.0)
            ELSE
                (1 - (b.title_embedding <=> query_embedding))
        END as similarity_score,
        'semantic'::text as search_type
    FROM bookmarks b
    WHERE b.user_id = user_id_param
    AND b.title_embedding IS NOT NULL
    AND (1 - (b.title_embedding <=> query_embedding)) > similarity_threshold
    ORDER BY similarity_score DESC, b.date_added DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Hybrid search combining semantic and keyword approaches
CREATE OR REPLACE FUNCTION search_bookmarks_hybrid(
    search_query text,
    user_id_param text,
    max_results int DEFAULT 20,
    semantic_weight float DEFAULT 0.7,
    keyword_weight float DEFAULT 0.3
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
    query_embedding vector(384);
    has_embeddings boolean;
BEGIN
    -- Check if we have embeddings available
    SELECT EXISTS(
        SELECT 1 FROM bookmarks 
        WHERE user_id = user_id_param 
        AND title_embedding IS NOT NULL
    ) INTO has_embeddings;

    -- If no embeddings, fall back to keyword search
    IF NOT has_embeddings THEN
        RETURN QUERY
        SELECT 
            b.id,
            b.title,
            b.url,
            b.folder,
            b.date_added,
            COALESCE(similarity(b.title, search_query), 0.0) as similarity_score,
            'keyword_fallback'::text as search_type
        FROM bookmarks b
        WHERE b.user_id = user_id_param
        AND (
            b.title ILIKE '%' || search_query || '%' OR
            b.url ILIKE '%' || search_query || '%' OR
            (pg_trgm_installed() AND similarity(b.title, search_query) > 0.1)
        )
        ORDER BY similarity_score DESC, b.date_added DESC
        LIMIT max_results;
        RETURN;
    END IF;

    -- Generate embedding for search query
    BEGIN
        query_embedding := generate_title_embedding(search_query);
    EXCEPTION WHEN OTHERS THEN
        -- If embedding generation fails, fall back to keyword search
        RETURN QUERY
        SELECT 
            b.id,
            b.title,
            b.url,
            b.folder,
            b.date_added,
            COALESCE(similarity(b.title, search_query), 0.0) as similarity_score,
            'keyword_fallback'::text as search_type
        FROM bookmarks b
        WHERE b.user_id = user_id_param
        AND (
            b.title ILIKE '%' || search_query || '%' OR
            b.url ILIKE '%' || search_query || '%'
        )
        ORDER BY similarity_score DESC, b.date_added DESC
        LIMIT max_results;
        RETURN;
    END;

    -- Perform hybrid search
    RETURN QUERY
    SELECT 
        b.id,
        b.title,
        b.url,
        b.folder,
        b.date_added,
        GREATEST(0.0, 
            (semantic_weight * (1 - (b.title_embedding <=> query_embedding))) +
            (keyword_weight * COALESCE(similarity(b.title, search_query), 0.0))
        ) as similarity_score,
        'hybrid'::text as search_type
    FROM bookmarks b
    WHERE b.user_id = user_id_param
    AND b.title_embedding IS NOT NULL
    AND (
        (1 - (b.title_embedding <=> query_embedding)) > 0.1 OR
        b.title ILIKE '%' || search_query || '%' OR
        b.url ILIKE '%' || search_query || '%' OR
        (pg_trgm_installed() AND similarity(b.title, search_query) > 0.1)
    )
    ORDER BY similarity_score DESC, b.date_added DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhanced keyword search with better ranking
CREATE OR REPLACE FUNCTION search_bookmarks_keywords_enhanced(
    search_query text,
    user_id_param text,
    max_results int DEFAULT 20
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
    clean_query text;
BEGIN
    -- Clean and prepare the search query
    clean_query := trim(lower(search_query));
    
    RETURN QUERY
    SELECT 
        b.id,
        b.title,
        b.url,
        b.folder,
        b.date_added,
        GREATEST(
            -- Exact title match gets highest score
            CASE WHEN lower(b.title) = clean_query THEN 1.0 ELSE 0.0 END,
            -- Title contains query gets high score
            CASE WHEN lower(b.title) LIKE '%' || clean_query || '%' THEN 0.8 ELSE 0.0 END,
            -- URL contains query gets medium score
            CASE WHEN lower(b.url) LIKE '%' || clean_query || '%' THEN 0.6 ELSE 0.0 END,
            -- Folder contains query gets lower score
            CASE WHEN b.folder IS NOT NULL AND lower(b.folder) LIKE '%' || clean_query || '%' THEN 0.4 ELSE 0.0 END,
            -- Trigram similarity if available
            CASE WHEN pg_trgm_installed() THEN 
                COALESCE(similarity(b.title, search_query), 0.0) * 0.7
            ELSE 0.0 END
        ) as similarity_score,
        'keyword'::text as search_type
    FROM bookmarks b
    WHERE b.user_id = user_id_param
    AND (
        lower(b.title) LIKE '%' || clean_query || '%' OR
        lower(b.url) LIKE '%' || clean_query || '%' OR
        (b.folder IS NOT NULL AND lower(b.folder) LIKE '%' || clean_query || '%') OR
        (pg_trgm_installed() AND similarity(b.title, search_query) > 0.1)
    )
    ORDER BY similarity_score DESC, b.date_added DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if pg_trgm is installed
CREATE OR REPLACE FUNCTION pg_trgm_installed()
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Improved embedding generation function with better text processing
CREATE OR REPLACE FUNCTION generate_title_embedding_enhanced(title_text text)
RETURNS vector AS $$
DECLARE
  hash_value bigint;
  embedding_array float[];
  i integer;
  clean_title text;
  word_count integer;
  char_count integer;
  has_numbers boolean;
  has_uppercase boolean;
  tech_score float := 0.0;
  domain_score float := 0.0;
BEGIN
  -- Validate input
  IF title_text IS NULL OR length(trim(title_text)) = 0 THEN
    RAISE EXCEPTION 'Title text cannot be null or empty';
  END IF;

  -- Clean and analyze the title
  clean_title := lower(trim(title_text));
  word_count := array_length(string_to_array(clean_title, ' '), 1);
  char_count := length(title_text);
  has_numbers := title_text ~* '\d';
  has_uppercase := title_text ~* '[A-Z]';
  
  -- Calculate technology relevance score
  tech_score := CASE 
    WHEN clean_title ~* 'github|git|code|programming|development|api|framework|library|tutorial|guide|documentation|docs' THEN 0.8
    WHEN clean_title ~* 'web|html|css|javascript|react|vue|angular|node|python|java|rust|go' THEN 0.7
    WHEN clean_title ~* 'design|ui|ux|interface|user|experience|figma|sketch|adobe' THEN 0.6
    WHEN clean_title ~* 'data|database|sql|analytics|machine|learning|ai|artificial|intelligence' THEN 0.9
    ELSE 0.0
  END;
  
  -- Calculate domain relevance score
  domain_score := CASE 
    WHEN clean_title ~* 'blog|article|post|news|medium|dev\.to' THEN 0.5
    WHEN clean_title ~* 'course|tutorial|learning|education|udemy|coursera' THEN 0.7
    WHEN clean_title ~* 'reference|manual|handbook|specification|rfc' THEN 0.8
    ELSE 0.0
  END;
  
  -- Generate a more sophisticated hash-based embedding
  hash_value := abs(hashtext(clean_title));
  
  -- Create a 384-dimensional vector with better feature distribution
  embedding_array := array_fill(0.0, ARRAY[384]);
  
  -- Fill dimensions with hash-based values and text features
  FOR i IN 1..384 LOOP
    embedding_array[i] := (((hash_value + i * 17 + word_count * 7 + char_count * 3) % 2000) - 1000) / 1000.0;
  END LOOP;
  
  -- Add enhanced text-based features for better semantic representation
  embedding_array[1] := LEAST(char_count / 100.0, 1.0);
  embedding_array[2] := LEAST(word_count / 20.0, 1.0);
  embedding_array[3] := CASE WHEN has_numbers THEN 0.5 ELSE -0.5 END;
  embedding_array[4] := CASE WHEN has_uppercase THEN 0.5 ELSE -0.5 END;
  embedding_array[5] := tech_score;
  embedding_array[6] := domain_score;
  embedding_array[7] := CASE WHEN clean_title ~* 'how|what|why|when|where' THEN 0.7 ELSE 0.0 END;
  embedding_array[8] := CASE WHEN clean_title ~* 'best|top|ultimate|complete|comprehensive' THEN 0.6 ELSE 0.0 END;
  embedding_array[9] := CASE WHEN clean_title ~* 'introduction|intro|getting|started|beginner' THEN 0.8 ELSE 0.0 END;
  embedding_array[10] := CASE WHEN clean_title ~* 'advanced|expert|professional|master|deep' THEN 0.8 ELSE 0.0 END;
  
  -- Add more semantic features
  embedding_array[11] := CASE WHEN clean_title ~* 'free|open|source|public' THEN 0.6 ELSE 0.0 END;
  embedding_array[12] := CASE WHEN clean_title ~* 'tool|utility|app|application|software' THEN 0.7 ELSE 0.0 END;
  embedding_array[13] := CASE WHEN clean_title ~* 'example|demo|sample|case|study' THEN 0.6 ELSE 0.0 END;
  embedding_array[14] := CASE WHEN clean_title ~* 'comparison|vs|versus|compare|difference' THEN 0.5 ELSE 0.0 END;
  embedding_array[15] := CASE WHEN clean_title ~* 'review|analysis|opinion|thoughts|experience' THEN 0.5 ELSE 0.0 END;
  
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION search_bookmarks_vector_enhanced(vector(384), text, float, int, boolean, boolean) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION search_bookmarks_hybrid(text, text, int, float, float) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION search_bookmarks_keywords_enhanced(text, text, int) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION pg_trgm_installed() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION generate_title_embedding_enhanced(text) TO anon, authenticated, service_role;

-- Test the enhanced functions
DO $$
DECLARE
  test_user_id text := 'test_enhanced_search';
  test_embedding vector(384);
  search_results record;
BEGIN
  -- Test enhanced embedding generation
  BEGIN
    test_embedding := generate_title_embedding_enhanced('Advanced React Tutorial for Developers');
    IF test_embedding IS NULL THEN
      RAISE EXCEPTION 'Enhanced embedding generation returned NULL';
    END IF;
    RAISE NOTICE 'Enhanced embedding generation test: PASSED';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Enhanced embedding generation test FAILED: %', SQLERRM;
  END;

  -- Test enhanced vector search
  BEGIN
    SELECT * FROM search_bookmarks_vector_enhanced(
      test_embedding,
      test_user_id,
      0.1,
      5,
      true,
      false
    ) INTO search_results LIMIT 1;
    RAISE NOTICE 'Enhanced vector search test: PASSED';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Enhanced vector search test FAILED: %', SQLERRM;
  END;

  -- Test hybrid search
  BEGIN
    SELECT * FROM search_bookmarks_hybrid(
      'react tutorial',
      test_user_id,
      5,
      0.7,
      0.3
    ) INTO search_results LIMIT 1;
    RAISE NOTICE 'Hybrid search test: PASSED';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Hybrid search test FAILED: %', SQLERRM;
  END;

  -- Test enhanced keyword search
  BEGIN
    SELECT * FROM search_bookmarks_keywords_enhanced(
      'react tutorial',
      test_user_id,
      5
    ) INTO search_results LIMIT 1;
    RAISE NOTICE 'Enhanced keyword search test: PASSED';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Enhanced keyword search test FAILED: %', SQLERRM;
  END;

  RAISE NOTICE 'All enhanced search functions tested successfully';
END $$;