#!/usr/bin/env python3
"""
FCE PDF Extractor — Main script
Supports both text-based and image-based (OCR) PDFs.

Usage:
  python extract_pdf.py <pdf_path>
  python extract_pdf.py <pdf_path> --output-dir output/ --ocr
"""

import json
import sys
from pathlib import Path

import typer
import pdfplumber
from rich.console import Console
from rich.progress import track

app = typer.Typer()
console = Console()


def extract_text_native(pdf_path: Path) -> list[dict]:
    """Extract text from selectable-text PDF pages."""
    pages = []
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(track(pdf.pages, description="Reading text...")):
            text = page.extract_text(x_tolerance=2, y_tolerance=2)
            if text and text.strip():
                pages.append({"page": i + 1, "text": text})
    return pages


def extract_text_ocr(pdf_path: Path, dpi: int = 300) -> list[dict]:
    """Extract text from image-based PDF pages using Tesseract OCR."""
    try:
        import pytesseract
        from pdf2image import convert_from_path
    except ImportError:
        console.print("[red]OCR dependencies missing. Run:[/] pip install pytesseract pdf2image Pillow")
        sys.exit(1)

    console.print("[blue]Converting PDF pages to images for OCR (this may take a few minutes)…[/]")
    images = convert_from_path(pdf_path, dpi=dpi)
    console.print(f"[green]Converted {len(images)} pages[/]")

    pages = []
    for i, img in enumerate(track(images, description="Running OCR...")):
        text = pytesseract.image_to_string(img, lang="eng", config="--psm 6")
        if text.strip():
            pages.append({"page": i + 1, "text": text})
    return pages


@app.command()
def main(
    pdf_path: Path = typer.Argument(..., help="Path to the FCE PDF file"),
    output_dir: Path = typer.Option(Path("output"), help="Output directory for JSON files"),
    ocr: bool = typer.Option(False, "--ocr", help="Use OCR (needed for image-based/scanned PDFs)"),
    dpi: int = typer.Option(300, "--dpi", help="DPI for OCR rendering (higher = better quality but slower)"),
    pages_limit: int = typer.Option(0, "--pages-limit", help="Limit number of pages (0 = all, useful for testing)"),
):
    output_dir.mkdir(parents=True, exist_ok=True)

    console.print(f"[bold blue]PDF:[/] {pdf_path}")
    console.print(f"[bold blue]Mode:[/] {'OCR (image-based)' if ocr else 'native text extraction'}")

    if ocr:
        pages = extract_text_ocr(pdf_path, dpi=dpi)
    else:
        pages = extract_text_native(pdf_path)

    if pages_limit > 0:
        pages = pages[:pages_limit]

    console.print(f"[green]Got text from {len(pages)} pages[/]")

    # Save raw text for debugging / manual review
    raw_output = output_dir / "raw_pages.json"
    with open(raw_output, "w", encoding="utf-8") as f:
        json.dump(pages, f, ensure_ascii=False, indent=2)
    console.print(f"[dim]Raw text → {raw_output}[/]")

    if not pages:
        console.print(
            "[yellow]No text extracted. If the PDF is image-based, re-run with --ocr flag.[/]\n"
            "  Example: python extract_pdf.py file.pdf --ocr"
        )
        return

    # Import parser after extracting
    from parsers.fce_parser import FCEParser
    parser = FCEParser(pages)
    quiz_sets = parser.parse()

    if not quiz_sets:
        console.print(
            "[yellow]Parser found no structured questions.\n"
            "Check output/raw_pages.json and update parsers/fce_parser.py to match your PDF layout.[/]"
        )
        return

    for quiz in quiz_sets:
        out_file = output_dir / f"{quiz['id']}.json"
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(quiz, f, ensure_ascii=False, indent=2)
        console.print(f"[green]✓[/] {len(quiz['questions'])} questions → {out_file}")

    total = sum(len(q["questions"]) for q in quiz_sets)
    console.print(f"\n[bold green]Done![/] {len(quiz_sets)} quiz sets, {total} questions total")
    console.print(f"\nNext step: copy JSON files from {output_dir}/ to web/src/data/ and register in web/src/lib/quiz-loader.ts")


if __name__ == "__main__":
    app()
