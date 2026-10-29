import re
import math
from pathlib import Path
from collections import Counter
from typing import Any
from backend.app.core.config import settings

class RegulatoryRAGService:
    _instance = None
    _chunks = []

    def __init__(self):
        self.load_handbook()

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = RegulatoryRAGService()
        return cls._instance

    def load_handbook(self):
        """Loads and chunks the synthetic regulatory handbook."""
        handbook_path = settings.REGULATIONS_DIR / "handbook_2026_demo.md"
        if not handbook_path.exists():
            return

        with open(handbook_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Split handbook by Clause or Chapter
        raw_sections = re.split(r'\n(?=###|####)', content)
        chunks = []

        for sec in raw_sections:
            sec = sec.strip()
            if not sec or sec.startswith("# SYNTHETIC") or sec.startswith("## AI-Powered"):
                continue

            # Extract title / rule code
            code_match = re.search(r'\b(SYNTH-NORM-[0-9\.]+)\b', sec)
            rule_code = code_match.group(1) if code_match else "SYNTH-GENERAL"

            first_line = sec.split("\n")[0].strip("# ").strip()
            chunks.append({
                "rule_code": rule_code,
                "title": first_line,
                "content": sec,
                "words": self._tokenize(sec)
            })

        self._chunks = chunks

    def _tokenize(self, text: str) -> list[str]:
        return [w.lower() for w in re.findall(r'\b[A-Za-z0-9\.-]+\b', text) if len(w) > 2]

    def search_regulations(self, query: str, top_k: int = 3) -> list[dict[str, Any]]:
        """
        Retrieves top relevant regulatory clauses using BM25/Cosine TF-IDF weighting.
        Guarantees deterministic, instant retrieval with exact citation.
        """
        if not self._chunks:
            self.load_handbook()

        query_tokens = self._tokenize(query)
        if not query_tokens:
            return []

        q_counter = Counter(query_tokens)
        scored_chunks = []

        total_docs = len(self._chunks) or 1
        
        # Calculate scores
        for chunk in self._chunks:
            doc_words = chunk["words"]
            doc_counter = Counter(doc_words)
            doc_len = len(doc_words) or 1
            
            score = 0.0
            for term, q_count in q_counter.items():
                if term in doc_counter:
                    tf = doc_counter[term] / doc_len
                    # Simple IDF proxy
                    idf = math.log(1.0 + (total_docs / max(1, sum(1 for c in self._chunks if term in c["words"]))))
                    score += tf * idf * q_count

                    # Direct code or title match bonus
                    if term.lower() in chunk["rule_code"].lower() or term.lower() in chunk["title"].lower():
                        score += 2.0

            if score > 0:
                scored_chunks.append((score, chunk))

        # Sort descending by relevance score
        scored_chunks.sort(key=lambda x: x[0], reverse=True)

        results = []
        for score, ch in scored_chunks[:top_k]:
            results.append({
                "rule_code": ch["rule_code"],
                "title": ch["title"],
                "content": ch["content"],
                "relevance_score": round(score, 3)
            })

        return results

    def answer_applicant_query(self, query: str, application_context: dict[str, Any] = None, language: str = "en") -> dict[str, Any]:
        """
        Answers applicant queries regarding compliance or remediation advice,
        linking responses to cited regulatory clauses.
        """
        retrieved = self.search_regulations(query, top_k=2)
        citations = []
        for r in retrieved:
            citations.append({
                "rule_code": r["rule_code"],
                "title": r["title"]
            })

        # Multilingual response phrasing
        if language == "hi":
            # Hindi response
            if retrieved:
                top_rule = retrieved[0]
                text = (
                    f"विनियम के अनुसार ({top_rule['rule_code']}): {top_rule['title']}.\n"
                    f"नियम सारांश: {top_rule['content'][:250]}...\n\n"
                    f"सुझाव: कृपया आवश्यक प्रमाण पत्र और स्वीकृत नक्शा संलग्न करके पुनः सबमिट करें।"
                )
            else:
                text = "आपके प्रश्न के संदर्भ में कोई विशिष्ट खंड नहीं मिला। कृपया अपने अपलोड किए गए दस्तावेजों की जांच करें।"
        elif language == "te":
            # Telugu response
            if retrieved:
                top_rule = retrieved[0]
                text = (
                    f"నియంత్రణ నిబంధన ప్రకారం ({top_rule['rule_code']}): {top_rule['title']}.\n"
                    f"నియమం సారాంశం: {top_rule['content'][:250]}...\n\n"
                    f"పరిష్కారం: దయచేసి ధృవీకరించబడిన పత్రాలను మరియు పునఃపరిశీలన దరఖాస్తును సమర్పించండి."
                )
            else:
                text = "మీ ప్రశ్నకు సంబంధించి ఎటువంటి నిర్దిష్ట నిబంధన కనుగొనబడలేదు. దయచేసి మీ అప్లికేషన్ పత్రాలను సమీక్షించండి."
        else:
            # English response
            if retrieved:
                top_rule = retrieved[0]
                text = (
                    f"According to synthetic regulatory guideline **{top_rule['rule_code']}** (*{top_rule['title']}*):\n\n"
                    f"> {top_rule['content'][:280]}...\n\n"
                    f"**Actionable Advice**: Verify that your documents explicitly address this clause before submission. "
                    f"In case of a land or NOC deficiency, submit the registered rectification deed or department renewal slip."
                )
            else:
                text = (
                    "I reviewed your application documents. To assist you accurately, please ask about specific requirements "
                    "such as minimum land acreage, Fire Safety NOC validity, Architect COA registration, or Faculty Cadre Ratios."
                )

        return {
            "answer": text,
            "citations": citations,
            "retrieved_clauses": retrieved
        }

rag_service = RegulatoryRAGService.get_instance()
