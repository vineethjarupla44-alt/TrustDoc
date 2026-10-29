import re
import uuid
import hashlib
from typing import List, Dict, Any, Optional
from backend.app.services.regulatory_rag.types import RegulatoryChunk, RegulatorySourceMetadata
from backend.app.services.regulatory_rag.extractor import RegulatoryExtractor

class RegulatoryChunker:
    """
    Chunks structural regulatory pages into discrete clause-level units,
    preserving exact chapter, section, page, and statutory reference metadata.
    """

    @classmethod
    def chunk_pages(
        cls,
        pages: List[Dict[str, Any]],
        source_meta: RegulatorySourceMetadata
    ) -> List[RegulatoryChunk]:
        chunks: List[RegulatoryChunk] = []

        current_chapter = "General Provisions"
        current_section = "Standard Regulatory Framework"

        for page in pages:
            page_num = page["page_number"]
            text = page["text"]

            lines = text.split("\n")
            buffer: List[str] = []

            def flush_buffer(clause_code: Optional[str], title_str: str, content_str: str):
                if not content_str.strip():
                    return
                # Check for ambiguity
                is_ambiguous = RegulatoryExtractor.check_ambiguity(content_str)
                chunk_id = str(uuid.uuid4())
                chunk_hash = hashlib.sha256(content_str.encode("utf-8")).hexdigest()
                token_count = len(re.findall(r"\b\w+\b", content_str))

                chunks.append(RegulatoryChunk(
                    id=chunk_id,
                    source_id=source_meta.id,
                    chapter=current_chapter,
                    section=current_section,
                    clause_number=clause_code,
                    page_number=page_num,
                    title=title_str[:250],
                    content=content_str.strip(),
                    token_count=token_count,
                    is_ambiguous=is_ambiguous,
                    chunk_hash=chunk_hash,
                    source_name=source_meta.source_name,
                    official_url=source_meta.official_url_or_ref
                ))

            # Pattern for Chapter headers
            # e.g., "### CHAPTER 1: LAND & LOCATION NORMS"
            # Pattern for Clause code
            # e.g., "SYNTH-NORM-1.1.1 (Urban / Metro Category): An institution offering..."
            # or "Clause 1.1: Minimum Contiguous Land Extent"
            
            raw_clauses = re.split(r"\n(?=- \*\*|\bSYNTH-NORM-|\bClause \d+)", text)

            for part in raw_clauses:
                part = part.strip()
                if not part:
                    continue

                # Check if chapter header
                ch_match = re.search(r"(?:###|CHAPTER)\s+(\d+[:\s][^\n]+)", part, re.IGNORECASE)
                if ch_match:
                    current_chapter = ch_match.group(0).replace("#", "").strip()

                sec_match = re.search(r"(?:####|Section)\s+([^\n]+)", part, re.IGNORECASE)
                if sec_match:
                    current_section = sec_match.group(0).replace("#", "").strip()

                # Extract specific clause code
                code_match = re.search(r"\b(SYNTH-NORM-[0-9\.]+|Clause\s+[0-9\.]+)\b", part)
                clause_code = code_match.group(1) if code_match else None

                # Extract title
                title_match = re.search(r"\(([^)]+)\)", part)
                if title_match:
                    title = title_match.group(1).strip()
                else:
                    first_line = part.split("\n")[0].strip("# -*").strip()
                    title = first_line[:100]

                flush_buffer(clause_code, title, part)

        return chunks
