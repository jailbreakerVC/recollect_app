-- Create function to generate embeddings
CREATE OR REPLACE FUNCTION generate_bookmark_embedding()
RETURNS TRIGGER AS $$
BEGIN
    -- Generate embedding only if title is present
    IF NEW.title IS NOT NULL AND NEW.title != '' THEN
        -- Use a placeholder for now - this will be replaced with actual OpenAI embedding
        NEW.title_embedding := (SELECT array_agg(random() * 2 - 1) FROM generate_series(1, 384) LIMIT 384)::vector;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically generate embeddings
CREATE OR REPLACE TRIGGER generate_bookmark_embedding_trigger
BEFORE INSERT OR UPDATE ON bookmarks
FOR EACH ROW
EXECUTE FUNCTION generate_bookmark_embedding();

-- Update existing bookmarks with embeddings
UPDATE bookmarks
SET title_embedding = (SELECT array_agg(random() * 2 - 1) FROM generate_series(1, 384) LIMIT 384)::vector
WHERE title IS NOT NULL AND title != '';

-- Add comment explaining the trigger
COMMENT ON FUNCTION generate_bookmark_embedding IS 'Automatically generates vector embeddings for bookmark titles';
