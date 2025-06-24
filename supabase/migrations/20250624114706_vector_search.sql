-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Create function to perform vector similarity search
CREATE OR REPLACE FUNCTION search_bookmarks_vector(
    query_embedding vector(384),
    user_id_param text,
    similarity_threshold float,
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
        1 - (b.title_embedding <> query_embedding) as similarity_score
    FROM bookmarks b
    WHERE b.user_id = user_id_param
    AND b.title_embedding IS NOT NULL
    AND 1 - (b.title_embedding <> query_embedding) > similarity_threshold
    ORDER BY similarity_score DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Create policy to allow vector search for authenticated users
CREATE POLICY "Enable vector search for authenticated users" ON bookmarks
    FOR SELECT
    TO authenticated
    USING (true);

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS idx_bookmarks_title_embedding 
ON bookmarks USING ivfflat (title_embedding vector_cosine_ops)
WITH (lists = 100);

-- Add comment explaining the function
COMMENT ON FUNCTION search_bookmarks_vector IS 'Search bookmarks using vector similarity search with OpenAI embeddings';
