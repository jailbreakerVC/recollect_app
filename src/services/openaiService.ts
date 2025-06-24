import { Logger } from '../utils/logger';

export class OpenAIService {
  private static async fetchWithRetry(
    url: string,
    options: RequestInit,
    maxRetries: number = 3
  ): Promise<any> {
    let retries = 0;

    while (retries < maxRetries) {
      try {
        const response = await fetch(url, options);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      } catch (error) {
        retries++;
        if (retries >= maxRetries) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, retries * 1000));
      }
    }
  }

  static async generateEmbedding(text: string): Promise<number[]> {
    try {
      Logger.info('OpenAIService', 'Generating embedding for text', { text });
      
      const response = await this.fetchWithRetry('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'text-embedding-ada-002',
          input: text
        })
      });

      if (!response.data || !response.data[0] || !response.data[0].embedding) {
        throw new Error('Invalid embedding response from OpenAI');
      }

      const embedding = response.data[0].embedding;
      Logger.info('OpenAIService', 'Successfully generated embedding', { dimensions: embedding.length });
      return embedding;
    } catch (error) {
      Logger.error('OpenAIService', 'Failed to generate embedding', error);
      throw error;
    }
  }

  static async generateQueryEmbedding(query: string): Promise<number[]> {
    try {
      // Clean up the query
      let cleanedQuery = query
        .toLowerCase()
        .replace(/[^\w\s]/g, '') // Remove punctuation
        .trim();

      // Handle common abbreviations and acronyms
      cleanedQuery = cleanedQuery
        .replace(/rag\s*gpt/gi, 'retrieval augmented generation gpt')
        .replace(/gpt/gi, 'generative pre-trained transformer')
        .replace(/ai/gi, 'artificial intelligence')
        .replace(/ml/gi, 'machine learning');

      // Generate multiple variations of the query
      const variations = [
        cleanedQuery, // Original cleaned query
        cleanedQuery.replace(/\s+/g, ' '), // Single space between words
        cleanedQuery.replace(/\s+/g, ' ').replace(/\b\w{1,2}\b/g, ''), // Remove short words
        cleanedQuery.replace(/\s+/g, ' ').replace(/\b\w{1,3}\b/g, ''), // Remove very short words
      ];

      // Generate embeddings for all variations
      const response = await openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: variations
      });

      if (!response.data || response.data.length === 0) {
        throw new Error("No embedding data returned from OpenAI");
      }

      // Average the embeddings to get a more robust representation
      const embeddings = response.data.map(d => d.embedding);
      const averagedEmbedding = embeddings.reduce((acc, curr) => 
        acc.map((val, i) => val + curr[i]), 
        new Array(embeddings[0].length).fill(0)
      ).map(val => val / embeddings.length);

      return averagedEmbedding;
    } catch (error) {
      Logger.error('OpenAIService', 'Failed to generate query embedding', error);
      throw error;
    }
  }
  private static processSearchQuery(query: string): string {
    // Convert to lowercase
    let processed = query.toLowerCase();
    
    // Remove common stop words
    const stopWords = ['the', 'is', 'in', 'on', 'at', 'for', 'to', 'of', 'and', 'or'];
    const words = processed.split(/\s+/).filter(word => 
      word.length > 2 && !stopWords.includes(word)
    );
    
    // Group related concepts
    const groupedConcepts = this.groupRelatedConcepts(words);
    
    // Combine into final query
    return groupedConcepts.join(' ');
  }

  private static groupRelatedConcepts(words: string[]): string[] {
    // Simple grouping based on common prefixes and related terms
    const groups: Record<string, string[]> = {};
    
    words.forEach(word => {
      // Check for common prefixes (e.g., 'coffee', 'morning')
      const prefix = word.slice(0, 3);
      if (!groups[prefix]) {
        groups[prefix] = [];
      }
      groups[prefix].push(word);
    });
    
    // Combine related words
    const combined = Object.values(groups)
      .map(group => group.length > 1 ? group.join('-') : group[0]);
    
    return combined;
  }
}
