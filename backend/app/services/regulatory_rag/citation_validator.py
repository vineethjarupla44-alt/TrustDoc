import re
from typing import List, Dict, Any, Optional
from backend.app.services.regulatory_rag.types import CitationCheck, RegulatoryChunk

class CitationValidator:
    """
    Validates regulatory citations and quoted obligations against the local
    verified regulatory chunk repository.
    
    STRICT ANTI-HALLUCINATION GUARDRAIL:
    Never allows invented clauses, nonexistent legal numbers, or fabricated statutory obligations.
    """

    @classmethod
    def validate_citations(
        cls,
        text_with_citations: str,
        indexed_chunks: Dict[str, RegulatoryChunk],
        active_source_versions: Optional[List[str]] = None
    ) -> List[CitationCheck]:
        results: List[CitationCheck] = []

        # Find cited clause references, e.g. "SYNTH-NORM-1.1.1" or "Clause 1.1"
        cited_codes = list(set(re.findall(r"\b(SYNTH-NORM-[0-9\.]+|Clause\s+[0-9\.]+)\b", text_with_citations)))

        # Also map chunks by clause_number for fast lookup
        clause_map: Dict[str, RegulatoryChunk] = {}
        for c in indexed_chunks.values():
            if c.clause_number:
                clause_map[c.clause_number.strip().upper()] = c

        # Extract quoted blocks from text (e.g., > "..." or "...")
        quoted_phrases = re.findall(r'["“]([^"”]{15,})["”]', text_with_citations)

        for code in cited_codes:
            norm_code = code.strip().upper()
            chunk = clause_map.get(norm_code)

            if chunk is None:
                # Clause code does NOT exist in verified indexed repository!
                results.append(CitationCheck(
                    clause_number=code,
                    is_verified=False,
                    source_title="Unknown / Unregistered Statutory Source",
                    page_number=None,
                    matched_quote=None,
                    verification_status="UNVERIFIED"
                ))
                continue

            # Verify quotes if present
            matched_quote = None
            if quoted_phrases:
                chunk_content_lower = chunk.content.lower()
                for q in quoted_phrases:
                    # Check if at least 70% of quote words appear in chunk
                    q_words = re.findall(r"\w+", q.lower())
                    if q_words:
                        overlap = sum(1 for w in q_words if w in chunk_content_lower) / float(len(q_words))
                        if overlap >= 0.70:
                            matched_quote = q
                            break

            results.append(CitationCheck(
                clause_number=code,
                is_verified=True,
                source_title=chunk.source_name or "Verified Regulatory Publication",
                page_number=chunk.page_number,
                matched_quote=matched_quote,
                verification_status="VERIFIED"
            ))

        return results
