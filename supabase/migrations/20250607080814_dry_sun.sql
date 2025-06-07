/*
  # Create bookmarks table and sync system

  1. New Tables
    - `bookmarks`
      - `id` (uuid, primary key)
      - `user_id` (text, references auth.users)
      - `chrome_bookmark_id` (text, unique identifier from Chrome)
      - `title` (text)
      - `url` (text)
      - `folder` (text, nullable)
      - `parent_id` (text, nullable)
      - `date_added` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `bookmarks` table
    - Add policies for authenticated users to manage their own bookmarks

  3. Indexes
    - Index on user_id for fast user queries
    - Index on chrome_bookmark_id for sync operations
    - Index on date_added for sorting
*/

CREATE TABLE IF NOT EXISTS bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  chrome_bookmark_id text,
  title text NOT NULL,
  url text NOT NULL,
  folder text,
  parent_id text,
  date_added timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own bookmarks"
  ON bookmarks
  FOR SELECT
  TO authenticated
  USING (user_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can insert their own bookmarks"
  ON bookmarks
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can update their own bookmarks"
  ON bookmarks
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.jwt() ->> 'sub')
  WITH CHECK (user_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can delete their own bookmarks"
  ON bookmarks
  FOR DELETE
  TO authenticated
  USING (user_id = auth.jwt() ->> 'sub');

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_chrome_id ON bookmarks(chrome_bookmark_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_date_added ON bookmarks(date_added DESC);
CREATE INDEX IF NOT EXISTS idx_bookmarks_folder ON bookmarks(folder);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_bookmarks_updated_at
  BEFORE UPDATE ON bookmarks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();