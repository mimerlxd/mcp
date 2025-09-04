import OpenAI from 'openai';

export class EmbeddingService {
  private openai: OpenAI;
  private model: string;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    this.openai = new OpenAI({ apiKey });
    this.model = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
  }

  async generateEmbedding(text: string): Promise<Float32Array> {
    try {
      const response = await this.openai.embeddings.create({
        model: this.model,
        input: text.trim(),
        encoding_format: 'float'
      });

      const embedding = response.data[0]?.embedding;
      if (!embedding) {
        throw new Error('No embedding returned from OpenAI');
      }

      return new Float32Array(embedding);
    } catch (error) {
      console.error('Embedding generation error:', error);
      throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateBatchEmbeddings(texts: string[]): Promise<Float32Array[]> {
    if (texts.length === 0) {
      return [];
    }

    // OpenAI has a limit on batch size, so we chunk if needed
    const BATCH_SIZE = 100;
    const results: Float32Array[] = [];

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      
      try {
        const response = await this.openai.embeddings.create({
          model: this.model,
          input: batch.map(text => text.trim()),
          encoding_format: 'float'
        });

        for (const embeddingData of response.data) {
          results.push(new Float32Array(embeddingData.embedding));
        }
      } catch (error) {
        console.error(`Batch embedding error for batch ${i / BATCH_SIZE + 1}:`, error);
        throw new Error(`Failed to generate batch embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return results;
  }

  getDimensions(): number {
    // text-embedding-3-small: 1536 dimensions
    // text-embedding-3-large: 3072 dimensions
    switch (this.model) {
      case 'text-embedding-3-large':
        return 3072;
      case 'text-embedding-3-small':
      case 'text-embedding-ada-002':
      default:
        return 1536;
    }
  }
}