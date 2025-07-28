import { pipeline } from '@xenova/transformers';

console.log('Downloading and caching model for offline use...');

// UPDATED: Changed the model name to the more powerful version
await pipeline('feature-extraction', 'Xenova/all-mpnet-base-v2');

console.log('Model downloaded successfully.');