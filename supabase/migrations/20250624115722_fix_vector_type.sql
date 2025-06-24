-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Add or modify the title_embedding column with proper vector type
ALTER TABLE bookmarks
ADD COLUMN IF NOT EXISTS title_embedding vector(384);

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS search_bookmarks_vector(vector(384), text, int);

-- Create function to perform vector similarity search
CREATE OR REPLACE FUNCTION search_bookmarks_vector(
    query_embedding vector(384),
    user_id_param text,
    max_results int,
    min_similarity float DEFAULT 0.05
)
RETURNS TABLE (
    id text,
    title text,
    url text,
    folder text,
    date_added timestamp with time zone,
    similarity_score float
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        b.id,
        b.title,
        b.url,
        b.folder,
        b.date_added,
        1 - (b.title_embedding <> query_embedding) as similarity_score
    FROM bookmarks b
    WHERE b.user_id = user_id_param
    AND b.title_embedding IS NOT NULL
    AND 1 - (b.title_embedding <> query_embedding) > min_similarity
    ORDER BY similarity_score DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Create function for keyword fallback search
CREATE OR REPLACE FUNCTION search_bookmarks_keywords(
    search_query text,
    user_id_param text,
    max_results int
)
RETURNS TABLE (
    id text,
    title text,
    url text,
    folder text,
    date_added timestamp with time zone,
    similarity_score float
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        b.id,
        b.title,
        b.url,
        b.folder,
        b.date_added,
        -- Use trigram similarity for keyword search
        similarity(b.title::text, search_query) as similarity_score
    FROM bookmarks b
    WHERE b.user_id = user_id_param
    AND b.title IS NOT NULL
    ORDER BY similarity_score DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Enable vector search for authenticated users" ON bookmarks;

-- Create policy to allow vector search for authenticated users
CREATE POLICY "Enable vector search for authenticated users" ON bookmarks
    FOR SELECT
    TO authenticated
    USING (true);

-- Drop existing index if it exists
DROP INDEX IF EXISTS idx_bookmarks_title_embedding;

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS idx_bookmarks_title_embedding 
ON bookmarks USING ivfflat (title_embedding vector_cosine_ops)
WITH (lists = 100);

-- Add comment explaining the function
COMMENT ON FUNCTION search_bookmarks_vector IS 'Search bookmarks using vector similarity search with OpenAI embeddings';
