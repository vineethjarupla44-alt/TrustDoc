import re
import math
from collections import Counter
from typing import List, Dict, Any, Optional
import numpy as np

from backend.app.services.regulatory_rag.types import GroundedClause, RegulatoryChunk
from backend.app.services.regulatory_rag.embeddings import EmbeddingProvider
from backend.app.services.regulatory_rag.vector_store import FAISSVectorStore

class HybridRetriever:
    """
    Hybrid clause retrieval engine fusing dense FAISS vector search with
    sparse BM25 token matching and exact clause code alignment.
    """

    def __init__(
        self,
        vector_store: FAISSVectorStore,
        embedder: EmbeddingProvider,
        chunks_map: Optional[Dict[str, RegulatoryChunk]] = None
    ):
        self.vector_store = vector_store
        self.embedder = embedder
        self.chunks_map = chunks_map or {}

    def update_chunks_map(self, chunks: List[RegulatoryChunk]):
        self.chunks_map = {c.id: c for c in chunks}

    def _tokenize(self, text: str) -> List[str]:
        return [w.lower() for w in re.findall(r"\b[A-Za-z0-9\.-]+\b", text) if len(w) > 2]

    def _compute_sparse_score(self, query_tokens: List[str], chunk: RegulatoryChunk, total_docs: int) -> float:
        chunk_text = f"{chunk.chapter} {chunk.section} {chunk.title} {chunk.content} {chunk.clause_number or ''}".lower()
        chunk_tokens = self._tokenize(chunk_text)
        if not chunk_tokens:
            return 0.0

        c_counter = Counter(chunk_tokens)
        doc_len = len(chunk_tokens)
        score = 0.0

        for term in query_tokens:
            if term in c_counter:
                tf = c_counter[term] / doc_len
                score += tf * 2.0
                # Exact clause code or title match multiplier
                if chunk.clause_number and term in chunk.clause_number.lower():
                    score += 5.0
                if term in chunk.title.lower():
                    score += 3.0

        return min(1.0, score)

    def retrieve(self, query: str, top_k: int = 4) -> List[GroundedClause]:
        """
        Executes hybrid search:
        1. Dense retrieval via FAISS.
        2. Sparse term matching over in-memory chunk catalog.
        3. Reciprocal weighted score fusion.
        """
        if not self.chunks_map:
            return []

        query_tokens = self._tokenize(query)
        dense_results: Dict[str, float] = {}

        # 1. FAISS dense search
        if self.vector_store.total_vectors > 0:
            q_emb = self.embedder.embed_text(query)
            faiss_hits = self.vector_store.search(q_emb, top_k=top_k * 2)
            for chunk_id, dist in faiss_hits:
                # Cosine distance bounded in [0.0, 1.0]
                dense_results[chunk_id] = max(0.0, min(1.0, (dist + 1.0) / 2.0))

        # 2. Sparse matching & fusion
        total_chunks = len(self.chunks_map)
        scored_candidates: List[GroundedClause] = []

        # Evaluate union of FAISS hits and sparse lexical matches
        candidate_ids = set(dense_results.keys())
        
        # Also include any chunk whose title, content, or clause_number matches query tokens
        for chunk_id, chunk in self.chunks_map.items():
            searchable_text = f"{chunk.title} {chunk.clause_number or ''} {chunk.content}".lower()
            if any(t in searchable_text for t in query_tokens):
                candidate_ids.add(chunk_id)

        # If candidates is still empty, scan all chunks for top lexical matches
        if not candidate_ids:
            candidate_ids = set(list(self.chunks_map.keys())[:50])

        for chunk_id in candidate_ids:
            chunk = self.chunks_map.get(chunk_id)
            if not chunk:
                continue

            dense_score = dense_results.get(chunk_id, 0.0)
            sparse_score = self._compute_sparse_score(query_tokens, chunk, total_chunks)

            # Fused hybrid score (60% dense vector, 40% sparse keyword)
            fused_score = round((0.60 * dense_score) + (0.40 * sparse_score), 4)

            scored_candidates.append(GroundedClause(
                chunk_id=chunk.id,
                clause_number=chunk.clause_number or "General",
                title=chunk.title,
                chapter=chunk.chapter,
                section=chunk.section,
                page_number=chunk.page_number,
                content=chunk.content,
                relevance_score=fused_score,
                source_title=chunk.source_name or "Regulatory Handbook",
                official_url=chunk.official_url,
                is_ambiguous=chunk.is_ambiguous
            ))

        # Sort descending by fused relevance score
        scored_candidates.sort(key=lambda x: x.relevance_score, reverse=True)
        return scored_candidates[:top_k]
