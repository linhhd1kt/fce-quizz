#!/usr/bin/env python3
"""
AI-powered FCE question extractor using GitHub Models API.

The API is OpenAI-compatible, authenticated with your GitHub token.
Model used: gpt-4o (supports JSON mode, best for structured extraction).

Usage:
    # One-shot: extract a specific section
    export GITHUB_TOKEN=$(gh auth token)
    python ai_extractor.py \\
        --raw output/raw_pages.json \\
        --pages 10-14 \\
        --part "Use of English Part 1: multiple-choice cloze, questions 1-8" \\
        --id "test1-use-of-english-part1-ai" \\
        --title "Test 1 — Use of English Part 1" \\
        --output output/ai-test1-part1.json

    # Batch: extract all sections defined in a config file
    python ai_extractor.py --batch batch_config.json
"""

import json
import os
import subprocess
import argparse
from pathlib import Path
from openai import OpenAI

GITHUB_MODELS_BASE_URL = "https://models.inference.ai.azure.com"
ANTHROPIC_BASE_URL = "https://api.anthropic.com"
DEFAULT_MODEL = "gpt-4o"

SYSTEM_PROMPT = """\
You are an expert Cambridge FCE (B2 First for Schools) exam parser.

Given OCR-extracted text from exam pages, extract all multiple-choice questions
and return a single JSON object. Follow these rules strictly:

1. Extract every multiple-choice question in the text.
2. For cloze (fill-the-gap) questions: "text" = "Question N: Choose the correct word to complete the gap."
   and "options" = the four word choices.
3. For reading/listening comprehension: "text" = the actual question sentence.
   If there is a passage or situation description, put it in "context".
4. "answer" must EXACTLY match one of the strings in "options" — character-for-character.
5. "explanation": 2-3 sentences. State why the correct answer fits the meaning/grammar,
   and briefly why the most tempting wrong option is incorrect.
6. Use the answer key if it appears in the text (e.g. "1 C  2 A  3 D ...").
7. IDs: use the format "<prefix>-<number>", e.g. "t1p1-1", "t1p5-31".

Return ONLY this JSON schema — no markdown, no extra text:
{
  "questions": [
    {
      "id": "string",
      "type": "multiple-choice",
      "text": "string",
      "context": "string or omit if none",
      "options": ["string", "string", "string"],
      "answer": "string (must match one option exactly)",
      "explanation": "string"
    }
  ]
}
"""


def get_github_token() -> str:
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        return token
    result = subprocess.run(["gh", "auth", "token"], capture_output=True, text=True)
    if result.returncode == 0 and result.stdout.strip():
        return result.stdout.strip()
    raise RuntimeError(
        "No GitHub token found. Either:\n"
        "  export GITHUB_TOKEN=$(gh auth token)\n"
        "  or: gh auth login"
    )


def is_claude_model(model: str) -> bool:
    return model.lower().startswith("claude")


def load_raw_pages(path: str) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def slice_text(pages: list[dict], start: int, end: int) -> str:
    chunks = []
    for p in pages:
        if start <= p["page"] <= end:
            chunks.append(f"--- PAGE {p['page']} ---\n{p['text']}")
    return "\n\n".join(chunks)


def call_ai(model: str, raw_text: str, part_hint: str) -> list[dict]:
    user_msg = (
        f"Section: {part_hint}\n\n"
        "--- OCR TEXT START ---\n"
        f"{raw_text}\n"
        "--- OCR TEXT END ---\n\n"
        "Extract all multiple-choice questions from the text above."
    )

    if is_claude_model(model):
        return _call_anthropic(model, user_msg)
    else:
        return _call_openai(model, user_msg)


def _call_anthropic(model: str, user_msg: str) -> list[dict]:
    import anthropic
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not set. Get one at https://console.anthropic.com/")

    client = anthropic.Anthropic(api_key=api_key)
    response = client.messages.create(
        model=model,
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_msg}],
        temperature=0.1,
    )
    content = response.content[0].text
    # Strip markdown code fences if present
    if content.startswith("```"):
        content = content.split("```")[1]
        if content.startswith("json"):
            content = content[4:]
    data = json.loads(content.strip())
    return _validate_questions(data.get("questions", []))


def _call_openai(model: str, user_msg: str) -> list[dict]:
    from openai import OpenAI
    token = get_github_token()
    client = OpenAI(base_url=GITHUB_MODELS_BASE_URL, api_key=token)
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_msg},
        ],
        response_format={"type": "json_object"},
        temperature=0.1,
        max_tokens=4096,
    )
    content = response.choices[0].message.content
    data = json.loads(content)
    return _validate_questions(data.get("questions", []))


def _validate_questions(questions: list[dict]) -> list[dict]:
    valid = []
    for q in questions:
        if q.get("answer") in q.get("options", []):
            valid.append(q)
        else:
            print(f"  [warn] Q {q.get('id')}: answer '{q.get('answer')}' not in options {q.get('options')} — skipped")
    return valid


def make_quiz_set(qid: str, title: str, description: str, questions: list[dict]) -> dict:
    return {
        "id": qid,
        "title": title,
        "description": description,
        "source": "B2 First for Schools 4 with answers",
        "totalQuestions": len(questions),
        "questions": questions,
    }


def process_one(model: str, pages: list[dict], cfg: dict) -> dict:
    start, end = map(int, cfg["pages"].split("-"))
    print(f"\n[{cfg['id']}] pages {start}-{end}  |  {cfg['part']}")

    raw_text = slice_text(pages, start, end)
    if not raw_text.strip():
        print("  [skip] no text found for this page range")
        return make_quiz_set(cfg["id"], cfg["title"], cfg.get("description", ""), [])

    print(f"  {len(raw_text):,} chars → calling {model}...")
    questions = call_ai(model, raw_text, cfg["part"])
    print(f"  extracted {len(questions)} questions")

    quiz_set = make_quiz_set(cfg["id"], cfg["title"], cfg.get("description", ""), questions)

    out_path = Path(cfg["output"])
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(quiz_set, f, indent=2, ensure_ascii=False)
    print(f"  saved → {out_path}")

    if questions:
        sample = questions[0]
        print(f"  sample Q: {sample['text'][:80]}...")
        print(f"  answer:   {sample['answer']}")
        print(f"  explain:  {sample.get('explanation', '')[:100]}...")

    return quiz_set


def main():
    parser = argparse.ArgumentParser(description="AI-powered FCE question extractor")
    parser.add_argument("--raw", default="output/raw_pages.json")
    parser.add_argument("--model", default=DEFAULT_MODEL)

    # Single-section mode
    parser.add_argument("--pages", help="Page range e.g. 10-20")
    parser.add_argument("--part", help="Section hint for the AI")
    parser.add_argument("--id", help="Quiz set ID")
    parser.add_argument("--title", help="Quiz set title")
    parser.add_argument("--description", default="AI-extracted FCE questions")
    parser.add_argument("--output", help="Output JSON path")

    # Batch mode
    parser.add_argument("--batch", help="Path to batch config JSON (list of section configs)")

    args = parser.parse_args()

    pages = load_raw_pages(args.raw)
    print(f"Loaded {len(pages)} pages  |  model: {args.model}")
    if is_claude_model(args.model) and not os.environ.get("ANTHROPIC_API_KEY"):
        raise RuntimeError("Claude model requires ANTHROPIC_API_KEY env var.\nGet one at: https://console.anthropic.com/")

    if args.batch:
        with open(args.batch, encoding="utf-8") as f:
            configs = json.load(f)
        results = []
        for cfg in configs:
            qs = process_one(args.model, pages, cfg)
            results.append(qs)
        total = sum(len(r["questions"]) for r in results)
        print(f"\nDone. {len(results)} quiz sets, {total} questions total.")
    else:
        if not all([args.pages, args.part, args.id, args.title, args.output]):
            parser.error("Single-section mode requires: --pages --part --id --title --output")
        cfg = {
            "pages": args.pages,
            "part": args.part,
            "id": args.id,
            "title": args.title,
            "description": args.description,
            "output": args.output,
        }
        process_one(args.model, pages, cfg)


if __name__ == "__main__":
    main()
