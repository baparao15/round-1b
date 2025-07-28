import { pipeline } from '@xenova/transformers';

function cosineSimilarity(v1, v2) {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    for (let i = 0; i < v1.length; i++) {
        dotProduct += v1[i] * v2[i];
        norm1 += v1[i] * v1[i];
        norm2 += v2[i] * v2[i];
    }
    if (norm1 === 0 || norm2 === 0) return 0;
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

export class Analyzer {
    static instance = null;

    static async getInstance() {
        if (this.instance === null) {
            console.log('Initializing analyzer and loading model...');
            this.instance = new Analyzer();
            // Using the more powerful model for higher accuracy
            try {
                // Prefer cached larger model if available (offline-friendly)
                this.instance.extractor = await pipeline('feature-extraction', 'Xenova/all-mpnet-base-v2');
            } catch (e) {
                console.warn('mpnet model not available locally, falling back to MiniLM (requires internet)');
                this.instance.extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
            }
            console.log('Model loaded successfully.');
        }
        return this.instance;
    }

    // This private helper function returns the entire Tensor object.
    async #embed(text) {
        return await this.extractor(text, { pooling: 'mean', normalize: true });
    }

    async calculateRelevance(chunks, persona, jobToDo) {
        if (!chunks || chunks.length === 0) return [];

        // The query now comes from main.js as an already expanded query
        const query = jobToDo; // jobToDo parameter now holds the expandedQuery
        console.log('Embedding the user query...');
        
        // Get the full Tensor object for the query, then extract its data array.
        const queryEmbeddingTensor = await this.#embed(query);
        const queryEmbedding = queryEmbeddingTensor.data;

        console.log(`Embedding ${chunks.length} document chunks in batches...`);
        const BATCH_SIZE = 64;
        const model_dim = queryEmbedding.length; // derive dimension dynamically

        let currentIndex = 0;
        while (currentIndex < chunks.length) {
            const batchContents = chunks.slice(currentIndex, currentIndex + BATCH_SIZE).map(c => c.content);
            const batchTensor = await this.#embed(batchContents);
            const batchData = batchTensor.data;

            for (let j = 0; j < batchContents.length; j++) {
                const globalIndex = currentIndex + j;
                const chunkEmbedding = Array.from(batchData.slice(j * model_dim, (j + 1) * model_dim));
                chunks[globalIndex].relevance_score = cosineSimilarity(queryEmbedding, chunkEmbedding);
            }

            currentIndex += BATCH_SIZE;
            console.log(`  Processed ${Math.min(currentIndex, chunks.length)}/${chunks.length} chunks...`);
        }

        console.log('Relevance scoring completed.');

        // Sort the chunks from most to least relevant based on the calculated score.
        return chunks.sort((a, b) => b.relevance_score - a.relevance_score);
    }
}