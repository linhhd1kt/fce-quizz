# Student User Flow — fce-quiz

## Flow Diagram

```mermaid
flowchart TD
    Start([Student receives link\n/s/CODE]) --> Open[Open link in browser]
    Open --> FetchSession[GET /api/sessions/by-code/CODE\nLoad quiz metadata]
    FetchSession --> Valid{Session found\nand active?}
    Valid -->|No| Error[Show error:\nInvalid or expired code]
    Error --> Done([End])

    Valid -->|Yes| EnterName[Enter student name]
    EnterName --> StartQuiz[Start quiz\nTimer begins]

    StartQuiz --> ShowQ[Display current question\nwith multiple-choice options]
    ShowQ --> Answer{Student answers\nor timer expires}
    Answer -->|Selects option| RecordAnswer[Record selected answer]
    Answer -->|Time runs out| RecordBlank[Record no answer]
    RecordAnswer --> NextQ{More questions?}
    RecordBlank --> NextQ

    NextQ -->|Yes| ShowQ
    NextQ -->|No| Submit[Submit attempt\nPOST /api/sessions/id/attempts]

    Submit --> ShowResults[Show score + correct answers\n/s/CODE/results]

    ShowResults --> BatchCheck{Is there a\nnext batch part?}
    BatchCheck -->|No| Done2([End])
    BatchCheck -->|Yes| NextBatch[Show link to next part\n/s/NEXT_CODE]
    NextBatch --> Open
```

## Step Descriptions

| Step | Details |
|---|---|
| Open link | URL is `/s/CODE` where CODE is the 6-character room code shared by teacher |
| Fetch session | Loads question count, title, and time-per-question; validates the room is active |
| Enter name | Free-text field; stored as `studentName` in the attempt record |
| Answer questions | Each question has a countdown timer; unanswered questions are recorded as blank |
| Submit | Sends all answers in one POST; server computes `score` and persists the attempt |
| See results | Shows score, total questions, and highlights correct/wrong answers |
| Next batch | If the quiz was split into batches, a link to the next part is offered automatically |
