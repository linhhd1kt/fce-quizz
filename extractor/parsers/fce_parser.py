"""
FCE-specific parser — updated to match actual OCR output format.

Patterns detected from OCR:
  Part 1 (p11): "1 A made B put C_ given D_ got"  (all on one line, _ is OCR noise)
  Part 5 (p17): "31 Harry suggests..." then A/B/C/D on separate lines with blank lines
  Listening (p25): "5 You hear..." + question, then A/B/C on separate lines
"""

import re
from typing import Optional


class FCEParser:
    def __init__(self, pages: list[dict]):
        self.pages = pages
        self.full_text = "\n".join(p["text"] for p in pages)

    def parse(self) -> list[dict]:
        quiz_sets = []
        for fn in [
            self._parse_part1_mcq,
            self._parse_part5_mcq,
            self._parse_listening_mcq,
            self._parse_answer_key,
        ]:
            qs = fn()
            if qs and qs.get("questions"):
                quiz_sets.append(qs)
        return quiz_sets

    # ------------------------------------------------------------------
    # Part 1 — MCQ cloze  (e.g. "1 A made B put C_ given D_ got")
    # ------------------------------------------------------------------
    def _parse_part1_mcq(self) -> Optional[dict]:
        # _ is OCR noise for space; allow it between letter labels and words
        pattern = re.compile(
            r'^(\d)\s+A\s+(.+?)\s+B[_ ]*(.+?)\s+C[_ ]*(.+?)\s+D[_ ]*(.+?)\s*$',
            re.MULTILINE,
        )
        answer_map = self._find_part1_answers()
        questions = []
        for m in pattern.finditer(self.full_text):
            num = int(m.group(1))
            if num < 1 or num > 8:
                continue
            options = [g.strip().lstrip('_').strip() for g in [m.group(2), m.group(3), m.group(4), m.group(5)]]
            answer_letter = answer_map.get(num, "")
            idx = {"A": 0, "B": 1, "C": 2, "D": 3}.get(answer_letter, 0)
            questions.append(self._make_q(
                qid=f"t1p1-{num}",
                text=f"Question {num}: Choose the correct word to complete the gap.",
                options=options,
                answer=options[idx] if answer_letter else options[0],
            ))

        if not questions:
            return None
        return self._make_set(
            qid="test1-use-of-english-part1",
            title="Test 1 — Use of English Part 1: Multiple-choice cloze",
            description="Choose the correct word (A, B, C or D) to complete each gap.",
            questions=questions,
        )

    # ------------------------------------------------------------------
    # Part 5 — Reading comprehension MCQ (multi-line, questions 31-36)
    # ------------------------------------------------------------------
    def _parse_part5_mcq(self) -> Optional[dict]:
        # Match: question_num + text, then options A/B/C/D (possibly with blank lines)
        pattern = re.compile(
            r'(?:^|\n)(3[1-6])\s+(.+?)\n'               # question num + text
            r'(?:\n)*'
            r'A[_ \.]*(.+?)\n'                            # option A
            r'(?:\n)*'
            r'B[_ \.]*(.+?)\n'                            # option B
            r'(?:\n)*'
            r'C[_ \.]*(.+?)\n'                            # option C
            r'(?:\n)*'
            r'D[_ \.]*(.+?)(?=\n(?:3[1-6]|\d+\s+What|\Z))',  # option D
            re.MULTILINE | re.DOTALL,
        )
        answer_map = self._find_answers_for_range(range(31, 37))
        questions = []
        for m in pattern.finditer(self.full_text):
            num = int(m.group(1))
            q_text = m.group(2).strip().replace('\n', ' ')
            options = [
                m.group(3).strip().replace('\n', ' '),
                m.group(4).strip().replace('\n', ' '),
                m.group(5).strip().replace('\n', ' '),
                m.group(6).strip().replace('\n', ' '),
            ]
            letter = answer_map.get(num, "A")
            idx = {"A": 0, "B": 1, "C": 2, "D": 3}.get(letter, 0)
            questions.append(self._make_q(
                qid=f"t1p5-{num}",
                text=q_text,
                options=options,
                answer=options[idx],
            ))

        if not questions:
            return None
        return self._make_set(
            qid="test1-reading-part5",
            title="Test 1 — Reading Part 5: Multiple choice",
            description="Read the text and choose the best answer (A, B, C or D) for each question.",
            questions=questions,
        )

    # ------------------------------------------------------------------
    # Listening MCQ — Parts 1 & 3 (3 options A/B/C, questions 1-10)
    # ------------------------------------------------------------------
    def _parse_listening_mcq(self) -> Optional[dict]:
        # Format: "5 You hear..." + question line, then A/B/C
        pattern = re.compile(
            r'(?:^|\n)(\d{1,2})\s+(You hear .+?\n.+?)\n'
            r'(?:\n)*'
            r'A[_ \.]*(.+?)\n'
            r'(?:\n)*'
            r'B[_ \.]*(.+?)\n'
            r'(?:\n)*'
            r'C[_ \.]*(.+?)(?=\n\d{1,2}\s+You hear|\Z)',
            re.MULTILINE | re.DOTALL,
        )
        answer_map = self._find_answers_for_range(range(1, 11))
        questions = []
        seen = set()
        for m in pattern.finditer(self.full_text):
            num = int(m.group(1))
            if num in seen or num < 1 or num > 10:
                continue
            seen.add(num)
            q_text = m.group(2).strip().replace('\n', ' ')
            options = [
                m.group(3).strip().replace('\n', ' '),
                m.group(4).strip().replace('\n', ' '),
                m.group(5).strip().replace('\n', ' '),
            ]
            letter = answer_map.get(num, "A")
            idx = {"A": 0, "B": 1, "C": 2}.get(letter, 0)
            questions.append(self._make_q(
                qid=f"t1listen-{num}",
                text=q_text,
                options=options,
                answer=options[idx],
            ))

        if not questions:
            return None
        return self._make_set(
            qid="test1-listening-part1",
            title="Test 1 — Listening Part 1: Multiple choice",
            description="Choose the best answer (A, B or C) based on what you hear.",
            questions=questions,
        )

    # ------------------------------------------------------------------
    # Answer key fallback — dense "num LETTER" pairs
    # ------------------------------------------------------------------
    def _parse_answer_key(self) -> Optional[dict]:
        pairs = re.findall(r'\b(\d{1,2})\s+([ABCD])\b', self.full_text)
        found: dict[int, str] = {}
        for num_s, letter in pairs:
            n = int(num_s)
            if 1 <= n <= 52:
                found[n] = letter
        if len(found) < 5:
            return None
        questions = []
        for num, letter in sorted(found.items()):
            questions.append(self._make_q(
                qid=f"ak-{num}",
                text=f"Question {num}",
                options=["A", "B", "C", "D"],
                answer=letter,
            ))
        return self._make_set(
            qid="answer-key-review",
            title="Answer Key Review",
            description="Quick drill using answer key data (question text needs manual review).",
            questions=questions,
        )

    # ------------------------------------------------------------------
    # Answer-key helpers
    # ------------------------------------------------------------------
    def _find_part1_answers(self) -> dict[int, str]:
        """Part 1: 8-answer block like '1 C  2 A  3 B ...'"""
        m = re.search(
            r'1\s+([ABCD])\s+2\s+([ABCD])\s+3\s+([ABCD])\s+4\s+([ABCD])\s+'
            r'5\s+([ABCD])\s+6\s+([ABCD])\s+7\s+([ABCD])\s+8\s+([ABCD])',
            self.full_text,
        )
        if m:
            return {i + 1: m.group(i + 1) for i in range(8)}
        return {}

    def _find_answers_for_range(self, q_range) -> dict[int, str]:
        result = {}
        for num in q_range:
            m = re.search(rf'\b{num}[\.\s]+([ABCD])\b', self.full_text)
            if m:
                result[num] = m.group(1)
        return result

    # ------------------------------------------------------------------
    # Factories
    # ------------------------------------------------------------------
    def _make_q(self, qid: str, text: str, options: list[str], answer: str) -> dict:
        return {"id": qid, "type": "multiple-choice", "text": text, "options": options, "answer": answer}

    def _make_set(self, qid: str, title: str, description: str, questions: list[dict]) -> dict:
        return {
            "id": qid,
            "title": title,
            "description": description,
            "source": "B2 First for Schools 4 with answers",
            "totalQuestions": len(questions),
            "questions": questions,
        }
