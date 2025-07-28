
# Persona-Driven Document Intelligence Analyzer

This project is a sophisticated document analysis engine built with Node.js. It intelligently extracts, ranks, and summarizes the most relevant sections from a collection of PDF documents based on a specific user persona and their "job-to-be-done." The system is designed to process multiple, independent collections in a single run and works entirely offline within a Docker container.

### Key Features

  * [cite\_start]**Semantic Understanding**: Uses a state-of-the-art AI model (`Xenova/all-mpnet-base-v2`) to understand the contextual meaning of text, not just keywords. [cite: 3]
  * **Persona-Driven**: Tailors search results to the specific needs and context of a defined user persona and their goal.
  * **Multi-Collection Processing**: Analyzes multiple, independent document collections in a single execution.
  * [cite\_start]**100% Offline Operation**: The entire application, including the AI model, is self-contained in a Docker image and requires no internet access to run. [cite: 2]
  * **Dynamic Query Generation**: Automatically expands a simple user request into a detailed, context-rich query to guide the AI model for more accurate results.
  * **Intelligent Text Chunking**: Parses documents by identifying semantic headings to create logical, self-contained sections for analysis.
  * **Automated Summarization**: For the most relevant sections, it generates concise summaries by identifying and extracting the most important sentences.

-----

## Technology Stack

  * [cite\_start]**Runtime**: Node.js (v20 or later) [cite: 2]
  * **NLP / AI**: `@xenova/transformers` for running state-of-the-art models in Node.js.
  * [cite\_start]**AI Model**: `Xenova/all-mpnet-base-v2`, a powerful sentence-transformer model for high-accuracy semantic search, is downloaded during the build process. [cite: 3]
  * **PDF Parsing**: `pdfjs-dist`, Mozilla's robust PDF parsing engine.
  * **Containerization**: Docker

-----

## Input Directory Structure

Before running the application, you must structure your input directory as follows. The root input folder should contain one or more "Collection" folders.

```
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
```

#### `input.json` File Format

Each collection folder **must** contain an `input.json` file that specifies the persona and job for that collection.

```json
{
  "persona": {
    "role": "Travel Planner for a group of college friends"
  },
  "job_to_be_done": {
    "task": "I need to plan a 4-day trip to the South of France."
  }
}
```

-----

## How to Run

> **Note**: Make sure you have Docker installed and running on your system. All commands should be executed from the project's root directory.

### Step 1: Build the Docker Image

This command builds your application into a self-contained image named `persona-analyzer`. During this step, the script downloads the required AI model, which will be cached inside the image. You only need to run this once, or again if you modify the code.

```bash
# This builds the Docker image and tags it as 'persona-analyzer'
docker build -t persona-analyzer .
```

### Step 2: Run the Analysis

This command starts the container. It will automatically find and process every collection folder within your local `input` directory.

  * **For macOS / Linux / Windows (WSL)**:

<!-- end list -->

```bash
# --rm: Automatically removes the container after it exits
# -v: Mounts your local input/output folders into the container
# --network none: Ensures the container runs completely offline
docker run --rm -v "$(pwd)/input:/app/input" -v "$(pwd)/output:/app/output" --network none persona-analyzer
```

  * **For Windows (PowerShell)**:

<!-- end list -->

```powershell
docker run --rm -v "${PWD}/input:/app/input" -v "${PWD}/output:/app/output" --network none persona-analyzer
```

After the script finishes, the results for each collection will be saved as separate `[collection_name]_result.json` files in your local `output` folder.

-----

## Methodology Explained

The accuracy of this solution comes from a multi-stage approach that combines intelligent document parsing with advanced semantic analysis.

1.  **Intelligent Document Chunking**: The system first uses a custom parser built on `pdfjs-dist`. This parser reads each PDF and uses a set of robust heuristics to identify semantic headings (e.g., "1.1 Introduction", "Key Attractions"). The document is then split into clean, logical chunks, each containing a heading and its corresponding content. This foundational step ensures the AI analyzes well-formed, contextually relevant sections.

2.  **Context-Rich Query Formulation**: To get the best results from the AI, the engine doesn't just use the raw "job-to-be-done." It creates an "expanded query" by dynamically extracting keywords from the persona and job, and combining them with domain-specific terms. This transforms a simple request into a detailed prompt that guides the model towards the most relevant information.

3.  **AI-Powered Relevance Ranking**: The core of the engine uses the `all-mpnet-base-v2` model to perform semantic analysis:

      * **Embedding**: The expanded query and the content of each document chunk are converted into high-dimensional vectors (embeddings) that capture their semantic meaning.
      * **Ranking**: The relevance of each chunk is calculated using **cosine similarity** between its vector and the query's vector. The results are then ranked by this score, ensuring that the sections most aligned with the user's intent appear first.

4.  **Refined Summarization**: For the top-ranked sections, the system performs a final summarization step. Instead of returning raw text, it scores individual sentences within a chunk based on keyword relevance and position. It then selects the top-scoring sentences to construct a concise and highly relevant summary, which is perfect for quick insights.
