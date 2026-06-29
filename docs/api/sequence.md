# API Sequence Diagrams — fce-quiz

## 1. PDF Extraction Flow

Teacher uploads a PDF; the server sends extracted text to Azure GPT-4o and returns structured MCQ questions.

```mermaid
sequenceDiagram
    actor Teacher as Teacher (Browser)
    participant App as Next.js API<br/>/api/extract-quiz
    participant AI as Azure GPT-4o

    Teacher->>App: POST /api/extract-quiz<br/>body: { pdfText: "..." }
    App->>App: Validate auth session<br/>(NextAuth)
    App->>AI: POST Azure inference endpoint<br/>system prompt + PDF text
    AI-->>App: JSON response<br/>{ questions: [...], skippedSections: [...] }
    App-->>Teacher: 200 OK<br/>{ questions, skippedSections }

    Teacher->>App: POST /api/quizzes<br/>body: { title, questions, timePerQuestion, ... }
    App->>App: Insert row into quizzes table<br/>(Drizzle ORM)
    App-->>Teacher: 201 Created<br/>{ id, title, ... }
```

## 2. Student Game Flow

Student joins a room by code, answers questions, and submits the attempt.

```mermaid
sequenceDiagram
    actor Student as Student (Browser)
    participant App as Next.js API
    participant DB as PostgreSQL

    Student->>App: GET /api/sessions/by-code/KH3X9A
    App->>DB: SELECT session WHERE code = 'KH3X9A'
    DB-->>App: session row (id, questionsSubset, isActive, ...)
    App-->>Student: 200 OK<br/>{ session, questions }

    Note over Student: Student enters name,<br/>answers each question (timed)

    Student->>App: POST /api/sessions/{id}/attempts<br/>body: { studentName, answers: [...] }
    App->>DB: Compute score from answers<br/>INSERT into attempts
    DB-->>App: attempt row (id, score, totalQuestions)
    App-->>Student: 201 Created<br/>{ score, totalQuestions, correctAnswers }

    Note over Student: Results page shown.<br/>If batch: link to next session offered.
```

## Endpoint Reference

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/extract-quiz` | POST | Teacher | Upload PDF text → GPT-4o → MCQ JSON |
| `/api/quizzes` | POST | Teacher | Save quiz to database |
| `/api/sessions` | POST | Teacher | Create a single room; returns 6-char code |
| `/api/sessions/batch` | POST | Teacher | Create N batch sessions from one quiz |
| `/api/sessions/batch/[batchId]` | GET | Teacher | Get all sessions in a batch |
| `/api/sessions/by-code/[code]` | GET | Public | Student fetches session by room code |
| `/api/sessions/[id]/attempts` | GET | Teacher | List all attempts for a session |
| `/api/sessions/[id]/attempts` | POST | Public | Student submits attempt |
