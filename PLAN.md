# FCE Quiz App — Implementation Plan

## Context
Build a quiz web app from "B2 First for Schools 4 with answers.pdf" so students can practice FCE exam questions interactively. First step toward a broader English-learning game ecosystem.

**Stack:** Python (PDF extraction) + Next.js 16 + TypeScript + JSON files (no DB for MVP)  
**Storage:** Static JSON files, localStorage for progress/scores  
**Quiz types MVP:** Multiple choice (expandable later)  
**MVP features:** Import JSON data, Progress tracking, Timer per question, Score history

---

## Project Structure
```
fce-quiz/
├── PLAN.md
├── extractor/                 # Python PDF extraction tool
│   ├── requirements.txt
│   ├── extract_pdf.py         # native text + --ocr mode
│   ├── parsers/fce_parser.py
│   └── output/                # Generated quiz JSON files
└── web/                       # Next.js 16 app
    └── src/
        ├── app/               # App router pages
        ├── components/        # UI components
        ├── types/quiz.ts      # Core TypeScript types
        ├── lib/               # quiz-loader, storage, scoring
        └── data/              # Quiz JSON files
```

---

## Checklist

### Phase 1 — Setup & Extraction
- [x] 1.1 Init Python extractor: `requirements.txt`
- [x] 1.2 Write `extract_pdf.py` (native + --ocr modes)
- [x] 1.3 Write FCE parser `parsers/fce_parser.py`
- [x] 1.4 Install Tesseract + pytesseract + pdf2image
- [ ] 1.5 Run OCR: `cd extractor && python extract_pdf.py "../B2 First for Schools 4 with answers.pdf" --ocr --pages-limit 30`
- [ ] 1.6 Review raw_pages.json, tune fce_parser.py, copy JSONs to `web/src/data/`

### Phase 2 — Next.js Foundation
- [x] 2.1 Create Next.js 16 app with TypeScript in `web/`
- [x] 2.2 Define TypeScript types in `src/types/quiz.ts`
- [x] 2.3 Implement `lib/quiz-loader.ts`
- [x] 2.4 Implement `lib/storage.ts` (localStorage)
- [x] 2.5 Implement `lib/scoring.ts`

### Phase 3 — Core UI
- [x] 3.1 Home page: list available quiz sets
- [x] 3.2 QuizPlayer component: countdown + question flow
- [x] 3.3 QuestionMultipleChoice component (feedback + explanations)
- [x] 3.4 Timer component (countdown per question)
- [x] 3.5 ProgressBar component
- [x] 3.6 Results page: score + per-question review
- [x] 3.7 Leaderboard page: local score history sorted by score

### Phase 4 — Polish & Import
- [x] 4.1 Import page: drag-and-drop JSON upload + schema validation
- [x] 4.2 Responsive dark-mode layout (Tailwind, mobile-friendly)

### Phase 5 — Extensibility (post-MVP)
- [ ] 5.1 Fill-in-the-blank quiz type
- [ ] 5.2 Word-formation quiz type
- [ ] 5.3 API routes for future backend
- [ ] 5.4 i18n (Vietnamese/English UI)

---

## How to run OCR extraction
```bash
cd extractor
pip install -r requirements.txt
python extract_pdf.py "../B2 First for Schools 4 with answers.pdf" --ocr
# Output: output/raw_pages.json + output/<id>.json
# Copy JSON files to: web/src/data/
# Register new IDs in: web/src/lib/quiz-loader.ts (BUILT_IN_IDS array)
```

## How to run the web app
```bash
cd web
npm install
npm run dev   # http://localhost:3000
```
