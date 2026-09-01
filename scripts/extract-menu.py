#!/usr/bin/env python3
"""
Extract text from PDF or image files using EasyOCR.
Outputs JSON to stdout: {"pages": [{"page_index": N, "text": "...", "source": "..."}]}
For images, outputs a single page entry.
For PDFs, converts each page to image then runs OCR.
"""
import sys
import json
import tempfile
import os


def extract_from_pdf(pdf_path: str) -> list[dict]:
    """Extract text from PDF pages — text-based first, then image OCR."""
    from pypdf import PdfReader
    import fitz  # PyMuPDF

    reader = PdfReader(pdf_path)
    pages_text = []

    for i, page in enumerate(reader.pages):
        # Try text extraction first (fast path for text-based PDFs)
        try:
            text = page.extract_text()
            if text and text.strip():
                pages_text.append({
                    "page_index": i,
                    "text": text.strip(),
                    "source": "pdf_text"
                })
                continue
        except Exception:
            pass

        # Fall back to image-based OCR via PyMuPDF
        try:
            page_pixmap = fitz.open(pdf_path)[i].get_pixmap(dpi=200)
            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
                tmp.write(page_pixmap.tobytes("png"))
                tmp_path = tmp.name

            try:
                import easyocr
                ocr_reader = easyocr.Reader(['en'], gpu=False)
                results = ocr_reader.readtext(tmp_path)
                text_lines = [line[1] for line in results]
                pages_text.append({
                    "page_index": i,
                    "text": "\n".join(text_lines),
                    "source": "pdf_image"
                })
            finally:
                os.unlink(tmp_path)
        except Exception as e:
            pages_text.append({
                "page_index": i,
                "text": f"[OCR error: {e}]",
                "source": "error"
            })

    return pages_text


def extract_from_image(image_path: str) -> dict:
    """Run EasyOCR on a single image file."""
    import easyocr
    reader = easyocr.Reader(['en'], gpu=False)
    results = reader.readtext(image_path)
    text_lines = [line[1] for line in results]
    return {
        "page_index": 0,
        "text": "\n".join(text_lines),
        "source": "image"
    }


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: extract-menu.py <file_path>"}))
        sys.exit(1)

    file_path = sys.argv[1]
    if not os.path.exists(file_path):
        print(json.dumps({"error": f"File not found: {file_path}"}))
        sys.exit(1)

    ext = os.path.splitext(file_path)[1].lower()

    try:
        if ext == '.pdf':
            pages = extract_from_pdf(file_path)
            print(json.dumps({"pages": pages, "type": "pdf"}))
        elif ext in ['.jpg', '.jpeg', '.png', '.webp', '.bmp']:
            result = extract_from_image(file_path)
            print(json.dumps({"pages": [result], "type": "image"}))
        else:
            print(json.dumps({"error": f"Unsupported file type: {ext}"}))
            sys.exit(1)
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
