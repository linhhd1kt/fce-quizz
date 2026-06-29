# Teacher User Flow — fce-quiz

## Flow Diagram

```mermaid
flowchart TD
    Start([Teacher opens app]) --> Login[/teacher/login\nEnter email + password]
    Login --> Auth{Auth OK?}
    Auth -->|No| Login
    Auth -->|Yes| Dashboard[/teacher\nDashboard: list quizzes]

    Dashboard --> UploadNew[Click 'New Quiz'\n/teacher/quizzes/new]
    UploadNew --> Upload[Upload PDF file]
    Upload --> Extract[POST /api/extract-quiz\nGPT-4o extracts MCQs]
    Extract --> Review[Review extracted questions\nEdit if needed]
    Review --> Save[Save quiz to DB\nPOST /api/quizzes]
    Save --> Dashboard

    Dashboard --> CreateRoom{Create room}
    CreateRoom -->|Single| SingleRoom[Click '+ Room'\nPOST /api/sessions\nGet 6-char code]
    CreateRoom -->|Multiple| BatchRoom[Click '+ Batch'\nPOST /api/sessions/batch\nGet N codes, one per ~15 questions]

    SingleRoom --> ShareLink[Share link: /s/CODE\nwith students]
    BatchRoom --> ShareLinks[Share N links with students\none per batch part]

    ShareLink --> Monitor[Monitor session\n/teacher/sessions/id]
    ShareLinks --> Monitor

    Monitor --> ViewResults[View attempts + scores\nGET /api/sessions/id/attempts]
    ViewResults --> Done([Done])
```

## Step Descriptions

| Step | URL / API | Notes |
|---|---|---|
| Login | `/teacher/login` | NextAuth credentials; redirects to dashboard on success |
| Dashboard | `/teacher` | Lists all quizzes; links to create rooms |
| Upload PDF | `/teacher/quizzes/new` | Client uploads file; server posts text to GPT-4o |
| Extract questions | `POST /api/extract-quiz` | Returns MCQ JSON; teacher can review before saving |
| Save quiz | `POST /api/quizzes` | Persists questions jsonb and metadata to DB |
| Single room | `POST /api/sessions` | Returns one 6-char code |
| Batch rooms | `POST /api/sessions/batch` | Splits quiz into ~15-question chunks; returns array of codes |
| Share link | `/s/CODE` | Students open this URL directly; no login required |
| View results | `/teacher/sessions/[id]` | Lists all student attempts with scores |
