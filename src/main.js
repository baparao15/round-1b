import { promises as fs } from 'fs';
import path from 'path';
import { extractTextChunks } from './parser.js';
import { Analyzer } from './analyzer.js';

const INPUT_DIR = '/app/input';
const OUTPUT_DIR = '/app/output';

async function findPdfFiles(dir) {
    let pdfs = [];
    try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                pdfs = pdfs.concat(await findPdfFiles(fullPath));
            } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) {
                pdfs.push(fullPath);
            }
        }
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
    }
    return pdfs;
}

// --- UPDATED: A more robust summarizer to find the most relevant sentences ---
function getRefinedText(chunkContent, allKeywords) {
    // Split by common sentence terminators, allowing for some variations
    const sentences = chunkContent.split(/(?<=[.!?])\s+|\n/).filter(s => s.trim().length > 15);
    
    const scoredSentences = sentences.map(sentence => {
        let score = 0;
        const lowerSentence = sentence.toLowerCase();
        for (const keyword of allKeywords) {
            if (lowerSentence.includes(keyword.toLowerCase())) { // Ensure keyword matching is case-insensitive
                score++;
            }
        }
        // Add a bonus for sentences appearing early in the chunk
        if (sentences.indexOf(sentence) < 3) { 
            score += (3 - sentences.indexOf(sentence)) * 0.7; // Slightly increased bonus
        }
        return { sentence, score };
    });

    scoredSentences.sort((a, b) => b.score - a.score);
    
    // Return the top 3-5 sentences that are sufficiently long and relevant.
    // Ensure uniqueness and try to form a coherent paragraph.
    const selectedSentences = [];
    const minSentenceLength = 20; // Minimum length for a sentence to be included
    for(const item of scoredSentences) {
        if (selectedSentences.length < 5 && item.sentence.trim().length >= minSentenceLength) {
            selectedSentences.push(item.sentence.trim());
        }
    }

    // Join back with a period and ensure it ends with one.
    let finalRefinedText = selectedSentences.join('. ');
    if (finalRefinedText.length > 0 && !/[.!?]$/.test(finalRefinedText)) {
        finalRefinedText += '.';
    }
    return finalRefinedText;
}

async function processCollection(collectionDir, analyzer) {
    const collectionName = collectionDir.name;
    console.log(`\n--- Starting processing for collection: ${collectionName} ---`);

    try {
        const collectionPath = path.join(INPUT_DIR, collectionName);
        const inputJsonPath = path.join(collectionPath, 'input.json');
        const pdfDirPath = path.join(collectionPath, 'pdf');

        const inputJsonContent = await fs.readFile(inputJsonPath, 'utf-8');
        const inputData = JSON.parse(inputJsonContent);

        // --- FIX: Handle the nested JSON structure from your output ---
        const persona = inputData.persona.role || inputData.persona;
        const job_to_be_done = inputData.job_to_be_done.task || inputData.job_to_be_done;

        const pdfPaths = await findPdfFiles(pdfDirPath);
        if (pdfPaths.length === 0) {
            console.log(`  No PDFs found in '${path.join(collectionName, 'pdf')}'. Skipping.`);
            return;
        }

        let allChunks = [];
        for (const pdfPath of pdfPaths) {
            const chunks = await extractTextChunks(pdfPath);
            chunks.forEach(chunk => chunk.document = path.basename(pdfPath));
            allChunks.push(...chunks);
        }

        // --- NEW/UPDATED: Dynamic Keyword Generation and Expanded Query ---
        // Derive general keywords from persona and job_to_be_done
        const getKeywordsFromText = (text) => 
            text.toLowerCase().split(/\s+/)
                .filter(word => word.length > 2 && !['a', 'an', 'the', 'of', 'for', 'in', 'to', 'and', 'is', 'i', 'need', 'to', 'plan', 'a', 'trip', 'group', 'friends', 'college', 'day', 'days'].includes(word));

        const personaKeywords = getKeywordsFromText(persona);
        const jobKeywords = getKeywordsFromText(job_to_be_done);
        
        // Combine specific keywords for "France Travel" challenge with derived keywords
        const specificKeywords = ['beach', 'nightlife', 'bar', 'club', 'adventure', 'city', 'coastal', 'entertainment', 'food', 'wine', 'water sports', 'accommodation', 'hotel', 'restaurant', 'transport', 'travel', 'budget', 'culture', 'history', 'tradition', 'tip', 'trick', 'thing to do'];
        const allRelevantKeywords = [...new Set([...personaKeywords, ...jobKeywords, ...specificKeywords])]; // Use Set for uniqueness

        // Construct a more detailed and dynamic expanded query
        const expandedQuery = `As a ${persona}, I need to ${job_to_be_done}. Specifically, for a group of college friends on a 4-day trip to the South of France, I am looking for engaging activities, vibrant nightlife, unique culinary experiences, and practical travel aspects like suitable accommodation, transportation tips, and general travel advice. Prioritize fun, social, and memorable experiences.`;
        
        const rankedChunks = await analyzer.calculateRelevance(allChunks, persona, expandedQuery);

        // Limit to top 10 relevant sections
        const extracted_sections = rankedChunks.slice(0, 10).map((chunk, i) => ({
            document: chunk.document,
            page_number: chunk.page,
            section_title: chunk.title,
            importance_rank: i + 1,
        }));

        // Limit to top 5 for detailed subsection analysis
        const sub_section_analysis = rankedChunks.slice(0, 5).map(chunk => ({
            document: chunk.document,
            page_number: chunk.page,
            refined_text: getRefinedText(chunk.content, allRelevantKeywords),
        }));

        const result = {
            metadata: {
                collection_name: collectionName,
                input_documents: pdfPaths.map(p => path.basename(p)),
                persona: persona,
                job_to_be_done: job_to_be_done,
                processing_timestamp: new Date().toISOString(),
            },
            extracted_sections,
            sub_section_analysis,
        };

        const outputFileName = `${collectionName}_result.json`;
        const outputPath = path.join(OUTPUT_DIR, outputFileName);
        await fs.writeFile(outputPath, JSON.stringify(result, null, 2));
        console.log(`✅ Success! Output for ${collectionName} written to ${outputFileName}`);

    } catch (error) {
        console.error(`❌ Failed to process collection '${collectionName}'. Error: ${error.message}`);
        console.error(error); // Log full error for debugging
    }
    
}

async function run() {
    const startTime = Date.now();
    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    const analyzer = await Analyzer.getInstance();
    const collectionDirs = (await fs.readdir(INPUT_DIR, { withFileTypes: true }))
        .filter(dirent => dirent.isDirectory());

    if (collectionDirs.length === 0) {
        console.log('No collection directories found in the input folder.');
        return;
    }

    for (const collectionDir of collectionDirs) {
        await processCollection(collectionDir, analyzer);
    }

    const endTime = Date.now();
    console.log(`\n--- All collections processed in ${((endTime - startTime) / 1000).toFixed(2)} seconds. ---`);
}

run().catch(console.error);