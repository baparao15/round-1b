import { readFileSync } from 'fs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { EOL } from 'os';

/**
 * A more robust heuristic to determine if a line of text is a heading.
 */
function isHeading(line) {
    const trimmed = line.trim();
    
    // Rule 1: Basic validation
    if (trimmed.length < 3 || trimmed.length > 150) return false;
    
    // Rule 2: Starts with common section numbering/titles (e.g., 1.1, Appendix A)
    if (/^(\d+(\.\d+)*\s+)?(CHAPTER|SECTION|APPENDIX|TABLE OF CONTENTS|ACKNOWLEDGEMENTS|REFERENCES|BIBLIOGRAPHY|INDEX)\b/i.test(trimmed)) return true;
    
    // Rule 3: All CAPS with at least two words and no ending punctuation common for sentences
    if (trimmed.toUpperCase() === trimmed && trimmed.split(' ').filter(w => w.length > 0).length >= 2 && !/[.,;!?]$/.test(trimmed)) return true;
    
    // Rule 4: Title Case heuristic (most words capitalized, not ending in common sentence punctuation)
    const words = trimmed.split(' ').filter(w => w.length > 0);
    if (words.length > 1 && words.length < 15) { // Increased max words slightly for longer titles
        const capitalizedWords = words.filter(word => word[0] === word[0].toUpperCase());
        // At least 70% of words are capitalized, and doesn't end with typical sentence punctuation
        if (capitalizedWords.length / words.length > 0.7 && !/[.,;!?]$/.test(trimmed)) { 
            return true;
        }
    }
    
    // Rule 5: Short, concise lines often indicate headings (e.g., 2-6 words, not ending in period)
    if (words.length > 1 && words.length <= 6 && trimmed[trimmed.length - 1] !== '.') return true;

    // Rule 6: Penalize lines that clearly look like sentences (ends with period/comma and contains multiple words)
    if ((trimmed.endsWith('.') || trimmed.endsWith(',')) && words.length > 3) return false;

    return false;
}
// In parser.js, inside extractTextChunks:
export async function extractTextChunks(pdfPath) {
    const dataBuffer = readFileSync(pdfPath);
    const uint8Array = new Uint8Array(dataBuffer);
    let doc;
    try {
        doc = await pdfjs.getDocument(uint8Array).promise;
    } catch (e) {
        console.error(`Error loading PDF document ${pdfPath}: ${e.message}`);
        return []; // Return empty chunks if document loading fails
    }

    const chunks = [];
    let currentHeading = "Document Start";
    let currentText = "";
    let currentChunkStartPage = 1;

    for (let i = 1; i <= doc.numPages; i++) {
        let page;
        let textContent;
        try {
            page = await doc.getPage(i);
            textContent = await page.getTextContent();
        } catch (e) {
            console.warn(`Warning: Could not get text content for page ${i} of ${pdfPath}: ${e.message}`);
            // Continue to next page, or break if consecutive pages fail
            continue; 
        }

        const pageTextRaw = textContent.items.map(item => item.str + (item.hasEOL ? EOL : '')).join('');
        const pageLines = pageTextRaw.split(EOL).filter(line => line.trim().length > 0);

        for (const line of pageLines) {
            if (isHeading(line)) {
                // Save the previous chunk if it has content
                if (currentText.trim().length > 0) {
                    chunks.push({
                        title: currentHeading,
                        content: currentText.trim(),
                        page: currentChunkStartPage
                    });
                }
                
                // Start a new chunk
                currentHeading = line.trim();
                currentText = "";
                currentChunkStartPage = i;
            } else {
                // Add line to current chunk content
                currentText += line + "\n";
            }
        }
    }
    
    // Push the final chunk if it has content
    if (currentText.trim().length > 0) {
        chunks.push({
            title: currentHeading,
            content: currentText.trim(),
            page: currentChunkStartPage
        });
    }
    
    return chunks;
}