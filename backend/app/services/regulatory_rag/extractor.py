import re
from pathlib import Path
from typing import List, Dict, Any
import fitz

class RegulatoryExtractor:
    """
    Extracts structural regulatory elements (Chapters, Sections, Clauses, Pages)
    from PDF and Markdown handbooks.
    """

    AMBIGUOUS_PATTERNS = [
        r"\bas deemed adequate\b",
        r"\bsubject to local municipal bylaws\b",
        r"\bat the discretion of\b",
        r"\bwhere feasible\b",
        r"\bto the satisfaction of\b",
        r"\breasonable access\b",
        r"\border of priority as decided\b"
    ]

    @classmethod
    def extract_from_file(cls, file_path: Path | str) -> List[Dict[str, Any]]:
        """
        Extracts structural pages from PDF or Markdown file.
        Returns list of page items: [{"page_number": int, "text": str}]
        """
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"Regulatory file not found: {file_path}")

        if path.suffix.lower() == ".pdf":
            return cls._extract_pdf(path)
        else:
            return cls._extract_text(path)

    @classmethod
    def _extract_pdf(cls, file_path: Path) -> List[Dict[str, Any]]:
        doc = fitz.open(str(file_path))
        pages = []
        for page_idx, page in enumerate(doc):
            text = page.get_text("text")
            pages.append({
                "page_number": page_idx + 1,
                "text": text
            })
        doc.close()
        return pages

    @classmethod
    def _extract_text(cls, file_path: Path) -> List[Dict[str, Any]]:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()

        # In markdown, split by explicit page breaks or simulate pages by chapter
        raw_pages = content.split("<!-- PAGE_BREAK -->")
        if len(raw_pages) > 1:
            return [{"page_number": i + 1, "text": p.strip()} for i, p in enumerate(raw_pages)]
        
        # Split by chapter as pseudo-pages if no page breaks
        chapters = re.split(r"\n(?=### CHAPTER|\n## CHAPTER)", content)
        pages = []
        for idx, ch in enumerate(chapters):
            ch_clean = ch.strip()
            if ch_clean:
                pages.append({
                    "page_number": idx + 1,
                    "text": ch_clean
                })
        return pages or [{"page_number": 1, "text": content}]

    @classmethod
    def check_ambiguity(cls, text: str) -> bool:
        """Flags clauses containing subjective or conditional discretionary terms."""
        t_lower = text.lower()
        return any(re.search(pat, t_lower) for pat in cls.AMBIGUOUS_PATTERNS)
