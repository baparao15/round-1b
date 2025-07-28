Persona-Driven Document Intelligence Analyzer
This project is a sophisticated document analysis engine built with Node.js. It intelligently extracts and ranks the most relevant sections from a collection of PDF documents based on a specific user persona and their "job-to-be-done." The system is designed to process multiple, independent collections in a single run and works entirely offline within a Docker container.

Key Features
Semantic Understanding: Uses a state-of-the-art AI model to understand the meaning of text, not just keywords.

Persona-Driven: Tailors results to the specific needs and context of a defined user persona.

Multi-Collection Processing: Analyzes multiple independent document collections in a single execution.

Offline-First: The entire application, including the AI model, is self-contained in a Docker image and requires no internet access to run.

Smart Filtering: Includes domain-specific logic to filter content based on job requirements (e.g., automatically filtering for "vegetarian" recipes).

Technology Stack
Runtime: Node.js (v20 or later)

NLP / AI: @xenova/transformers for running state-of-the-art models in Node.js.

AI Model: Xenova/all-mpnet-base-v2 (~420 MB), a powerful sentence-transformer model for high-accuracy semantic search.

PDF Parsing: pdfjs-dist, Mozilla's powerful and robust PDF rendering engine.

Containerization: Docker

Input Directory Structure
Before running the application, you must structure your input directory as follows. The root input folder should contain one or more "Collection" folders.

input/
│
├── Collection 1/
│   ├── pdf/
│   │   ├── document_A.pdf
│   │   └── document_B.pdf
│   └── input.json
│
└── Collection 2/
    ├── pdf/
    │   └── another_document.pdf
    └── input.json

input.json File Format:
Each collection folder must contain an input.json file that specifies the persona and job for that collection.

{
  "persona": "Travel Planner",
  "job_to_be_done": "Plan a trip of 4 days for a group of 10 college friends."
}

How to Run
Make sure you have Docker installed and running on your system. All commands should be executed from the project's root directory.

Step 1: Build the Docker Image
This command builds your application and downloads the AI model into a self-contained image named persona-analyzer. You only need to run this once, or again if you modify the code.

'''docker build -t persona-analyzer .'''

(Note: If you encounter issues with Docker's cache after changing files, you can force a complete rebuild with docker build --no-cache -t persona-analyzer .)

Step 2: Run the Analysis
This command starts the container. It will automatically find and process every collection folder in your input directory.

For macOS / Linux / WSL:
'''docker run --rm -v "$(pwd)/input:/app/input" -v "$(pwd)/output:/app/output" --network none persona-analyzer'''

For Windows PowerShell:
'''docker run --rm -v "${PWD}/input:/app/input" -v "${PWD}/output:/app/output" --network none persona-analyzer'''

After the script finishes, the results for each collection will be saved as separate _result.json files in your local output folder.

Methodology Explained
The accuracy of this solution comes from a multi-stage approach that combines intelligent document parsing with advanced semantic analysis.

Recipe-Aware Parsing: The system first uses a custom parser built on pdfjs-dist. Instead of generic heading detection, this parser is specifically designed to identify and isolate individual recipes within the documents. It splits the text into clean chunks, each containing a recipe's title and its full content (ingredients and instructions). This foundational step is critical for accurate downstream analysis.

Context-Rich Query Formulation: To get the best results from the AI, we create an "expanded query" that combines the user's persona and job_to_be_done with additional context implied by the task. For example, a request for "college friends" is expanded to prioritize "fun, social activities, nightlife, and group-friendly" options. This guides the model towards the most relevant results.

Smart Semantic Filtering & Ranking: The core of the engine uses the all-mpnet-base-v2 model to perform semantic analysis:

Pre-Filtering: Before any analysis, the system performs a critical filtering step. For a job requiring a "vegetarian" menu, it automatically scans and discards any recipe chunk containing non-vegetarian keywords (e.g., 'chicken', 'pork', 'fish'). This hard rule ensures all suggestions strictly adhere to the user's constraints.

Embedding: The expanded query and the content of each filtered chunk are converted into high-dimensional vectors (embeddings) that capture their semantic meaning.

Ranking: The relevance of each recipe is calculated using cosine similarity between its vector and the query's vector. The results are then ranked by this score, ensuring the most relevant items appear first.

Targeted Summarization: For the subsection_analysis, the system returns the full, clean recipe text from the top-ranked chunks. Because the initial parsing step was so precise, the entire content of the chunk is the "refined text" needed, providing actionable details like ingredients and instructions.