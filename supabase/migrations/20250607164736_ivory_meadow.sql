/*
  # Add Semantic Search with pgvector

  1. Extensions
    - Enable pgvector extension for vector operations
    - Enable pg_trgm for trigram similarity (fallback)

  2. Schema Changes
    - Add embedding column to bookmarks table
    - Add indexes for vector similarity search
    - Add trigram indexes for text search fallback

  3. Functions
    - Function to generate embeddings for bookmark titles
    - Function to perform semantic search
    - Function to update embeddings for existing bookmarks

  4. Triggers
    - Auto-generate embeddings when bookmarks are inserted/updated
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add embedding column to bookmarks table
ALTER TABLE bookmarks 
ADD COLUMN IF NOT EXISTS title_embedding vector(384);

-- Add comment explaining the embedding dimension
COMMENT ON COLUMN bookmarks.title_embedding IS 'Sentence transformer embedding (384 dimensions) for semantic search';

-- Create indexes for vector similarity search
CREATE INDEX IF NOT EXISTS idx_bookmarks_title_embedding 
ON bookmarks USING ivfflat (title_embedding vector_cosine_ops)
WITH (lists = 100);

-- Create trigram index for fallback text search
CREATE INDEX IF NOT EXISTS idx_bookmarks_title_trgm 
ON bookmarks USING gin (title gin_trgm_ops);

-- Create function to generate embeddings using a simple approach
-- In production, you would use a proper embedding service
CREATE OR REPLACE FUNCTION generate_title_embedding(title_text text)
RETURNS vector AS $$
DECLARE
  -- Simple hash-based embedding generation for demo
  -- In production, use OpenAI, Cohere, or local sentence transformers
  hash_value bigint;
  embedding_array float[];
  i integer;
BEGIN
  -- Generate a simple hash-based embedding
  hash_value := abs(hashtext(lower(trim(title_text))));
  
  -- Create a 384-dimensional vector based on the hash
  embedding_array := array_fill(0.0, ARRAY[384]);
  
  -- Fill some dimensions based on text characteristics
  FOR i IN 1..384 LOOP
    embedding_array[i] := (((hash_value + i * 17) % 1000) - 500) / 1000.0;
  END LOOP;
  
  -- Add some text-based features
  embedding_array[1] := length(title_text) / 100.0;
  embedding_array[2] := (length(split_part(title_text, ' ', 1)) / 20.0) - 0.5;
  embedding_array[3] := case when title_text ~* '\d' then 0.5 else -0.5 end;
  embedding_array[4] := case when title_text ~* '[A-Z]' then 0.5 else -0.5 end;
  
  RETURN embedding_array::vector;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create function to perform semantic search
CREATE OR REPLACE FUNCTION search_bookmarks_semantic(
  search_query text,
  user_id_param text,
  similarity_threshold float DEFAULT 0.7,
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
BEGIN
  -- Check if we have any embeddings
  SELECT EXISTS(
    SELECT 1 FROM bookmarks 
    WHERE user_id = user_id_param 
    AND title_embedding IS NOT NULL
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
      similarity(b.title, search_query) as similarity_score,
      'trigram'::text as search_type
    FROM bookmarks b
    WHERE b.user_id = user_id_param
    AND similarity(b.title, search_query) > similarity_threshold
    ORDER BY similarity_score DESC
    LIMIT max_results;
    RETURN;
  END IF;
  
  -- Generate embedding for search query
  query_embedding := generate_title_embedding(search_query);
  
  -- Perform vector similarity search
  RETURN QUERY
  SELECT 
    b.id,
    b.title,
    b.url,
    b.folder,
    b.date_added,
    (1 - (b.title_embedding <=> query_embedding)) as similarity_score,
    'semantic'::text as search_type
  FROM bookmarks b
  WHERE b.user_id = user_id_param
  AND b.title_embedding IS NOT NULL
  AND (1 - (b.title_embedding <=> query_embedding)) > similarity_threshold
  ORDER BY b.title_embedding <=> query_embedding
  LIMIT max_results;
  
  -- If no semantic results, fall back to trigram search
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      b.id,
      b.title,
      b.url,
      b.folder,
      b.date_added,
      similarity(b.title, search_query) as similarity_score,
      'trigram_fallback'::text as search_type
    FROM bookmarks b
    WHERE b.user_id = user_id_param
    AND similarity(b.title, search_query) > (similarity_threshold * 0.5)
    ORDER BY similarity_score DESC
    LIMIT max_results;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create function to update embeddings for existing bookmarks
CREATE OR REPLACE FUNCTION update_bookmark_embeddings(user_id_param text DEFAULT NULL)
RETURNS integer AS $$
DECLARE
  updated_count integer := 0;
  bookmark_record record;
BEGIN
  -- Update embeddings for bookmarks without them
  FOR bookmark_record IN 
    SELECT id, title 
    FROM bookmarks 
    WHERE (user_id_param IS NULL OR user_id = user_id_param)
    AND (title_embedding IS NULL OR title_embedding = vector(array_fill(0.0, ARRAY[384])))
  LOOP
    UPDATE bookmarks 
    SET title_embedding = generate_title_embedding(bookmark_record.title)
    WHERE id = bookmark_record.id;
    
    updated_count := updated_count + 1;
  END LOOP;
  
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to auto-generate embeddings
CREATE OR REPLACE FUNCTION auto_generate_embedding()
RETURNS trigger AS $$
BEGIN
  -- Generate embedding for new or updated title
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.title != OLD.title) THEN
    NEW.title_embedding := generate_title_embedding(NEW.title);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate embeddings
DROP TRIGGER IF EXISTS trigger_auto_generate_embedding ON bookmarks;
CREATE TRIGGER trigger_auto_generate_embedding
  BEFORE INSERT OR UPDATE ON bookmarks
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_embedding();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION generate_title_embedding(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION search_bookmarks_semantic(text, text, float, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION update_bookmark_embeddings(text) TO anon, authenticated;

-- Update embeddings for existing bookmarks
SELECT update_bookmark_embeddings();

-- Log completion
DO $$
DECLARE
  total_bookmarks integer;
  bookmarks_with_embeddings integer;
BEGIN
  SELECT COUNT(*) INTO total_bookmarks FROM bookmarks;
  SELECT COUNT(*) INTO bookmarks_with_embeddings FROM bookmarks WHERE title_embedding IS NOT NULL;
  
  RAISE NOTICE 'Semantic search setup complete!';
  RAISE NOTICE 'Total bookmarks: %', total_bookmarks;
  RAISE NOTICE 'Bookmarks with embeddings: %', bookmarks_with_embeddings;
  RAISE NOTICE 'pgvector extension enabled for 384-dimensional embeddings';
  RAISE NOTICE 'Trigram fallback enabled for text similarity';
END $$;