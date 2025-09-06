# 🎓 DocChat – AI Study Buddy with Video Timestamp Q&A

DocChat is an AI-powered learning assistant that lets students ask questions from their courses, notes, or subtitles (VTT/SRT files) and get direct answers with precise video timestamps.


### (Whole App is shifted to Nextjs and Nodejs Hybrid mode) All the vtt/srt already indexed in qdrant db just open site and ask question according to vtt/srt files.


YT Demo - [https://youtu.be/Tcc5-visdEs]

⸻

## ✨ What It Does
	•	📂 Course Uploads
	•	Upload a whole course folder (e.g., nodejs/ or python/) with structured subtitles (VTT/SRT).
	•	The system automatically infers Course → Section → Lesson metadata from the folder and file names.
	•	📝 Text Notes
	•	Paste any text (summaries, class notes, FAQs, research) and make it searchable instantly.
	•	📄 File Uploads
	•	Supports PDF, TXT, CSV, JSON, and subtitles (VTT/SRT).
	•	💡 AI Q&A with Timestamps
	•	Ask natural questions, and the AI replies with context + references.
	•	Answers include section, lesson, and exact time ranges → so you can click & jump straight into the video.
	•	🗂 Pre-Embedded Knowledge Base
	•	All subtitle files (VTT/SRT) have been pre-embedded into Qdrant Cloud for high-speed semantic search.
	•	This means DocChat is ready-to-go: students can start chatting with existing course data without needing to upload first.
	•	🎭 Friendly Mentor Persona
	•	Inspired by Hitesh Choudhary’s teaching vibe — responses feel like your study buddy, guiding with clarity and confidence.

⸻

## 🧠 How It Works (Under the Hood)
	1.	Vector Database (Qdrant Cloud)
	•	All course subtitles and notes are pre-embedded using OpenAI’s text-embedding-3-small model (dimension: 1536).
	•	Stored in Qdrant with metadata → course, section, lesson, timestamps.
	2.	Semantic Search + RAG (Retrieval-Augmented Generation)
	•	When a user asks a question, the query is expanded (HYDE technique: synthetic queries).
	•	Relevant chunks from Qdrant are retrieved and passed into the LLM (GPT-4.1).
	3.	Timestamp-Aware Responses
	•	AI responses include structured references:
	•	Section name
	•	Lesson ID
	•	Exact timecodes (mm:ss–mm:ss)
	4.	UI/UX
	•	Sidebar for uploads (files, text, folders).
	•	Prominent Course Selector for context filtering.
	•	Chat interface with clean message bubbles, code formatting, and reference pills (⏱ Jump to timestamps).

⸻

## 🛠 Tech Stack
	•	Frontend → Next.js 14 (App Router) + TailwindCSS
	•	Backend (Ingest Worker) → Node.js + Express
	•	Vector Store → Qdrant Cloud (1536-dim embeddings)
	•	LLM → OpenAI GPT-4.1 (chat), text-embedding-3-small (embeddings)
	•	Other Tools → LangChain, Multer (uploads), Cheerio (HTML parsing), PDF/CSV/JSON loaders
