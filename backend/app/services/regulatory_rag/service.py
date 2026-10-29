import hashlib
import uuid
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.services.regulatory_rag.types import (
    RegulatorySourceMetadata,
    RegulatoryChunk,
    GroundedClause,
    ComplianceEvaluationDossier,
    CitationCheck
)
from backend.app.services.regulatory_rag.embeddings import get_embedding_provider, EmbeddingProvider
from backend.app.services.regulatory_rag.vector_store import FAISSVectorStore
from backend.app.services.regulatory_rag.extractor import RegulatoryExtractor
from backend.app.services.regulatory_rag.chunker import RegulatoryChunker
from backend.app.services.regulatory_rag.retriever import HybridRetriever
from backend.app.services.regulatory_rag.evaluator import ComplianceEvaluator
from backend.app.services.regulatory_rag.citation_validator import CitationValidator
from backend.app.services.regulatory_rag.grounded_explainer import GroundedExplainer

class RegulatoryComplianceRAGService:
    """
    Master orchestrator for regulatory source ingestion, structural chunking,
    FAISS vector indexing, hybrid clause retrieval, 5-state compliance evaluation,
    and grounded anti-hallucination explanations.
    """

    _instance = None

    def __init__(self):
        self.embedder: EmbeddingProvider = get_embedding_provider()
        self.vector_store = FAISSVectorStore(dimension=self.embedder.dimension)
        self.chunks_map: Dict[str, RegulatoryChunk] = {}
        self.active_sources: Dict[str, RegulatorySourceMetadata] = {}
        self.retriever = HybridRetriever(self.vector_store, self.embedder, self.chunks_map)

    @classmethod
    def get_instance(cls) -> "RegulatoryComplianceRAGService":
        if cls._instance is None:
            cls._instance = RegulatoryComplianceRAGService()
        return cls._instance

    def initialize_default_sources(self, db: Optional[Session] = None):
        """Loads and indexes the statutory demo handbook if vector store is empty."""
        handbook_path = settings.REGULATIONS_DIR / "handbook_2026_demo.md"
        if not handbook_path.exists():
            return

        source_meta = RegulatorySourceMetadata(
            id="src-aicte-aph-2026",
            source_name="AICTE Approval Process Handbook (APH) 2026-2027",
            authority="All India Council for Technical Education (AICTE)",
            edition_year="2026-2027",
            version="v2026.1",
            official_url_or_ref="https://facilities.aicte-india.org/approval/process-handbook-2026-27",
            publication_date=datetime(2026, 1, 15, tzinfo=timezone.utc),
            effective_date=datetime(2026, 4, 1, tzinfo=timezone.utc),
            is_active=True,
            sha256_hash="d5f3089d45e03ec8aaec18bb314d18ec3324683017a151b7fe078f45a0b73489",
            file_path=str(handbook_path)
        )

        self.ingest_source(
            file_path=handbook_path,
            source_meta=source_meta,
            db=db
        )

    def ingest_source(
        self,
        file_path: Any = None,
        source_meta: Any = None,
        db: Optional[Session] = None
    ) -> Dict[str, Any]:
        """
        Ingests a regulatory publication (PDF/Markdown):
        1. Calculates file SHA-256.
        2. Structural extraction (chapters, sections, clauses, pages).
        3. Embeds chunks via FAISS vector index.
        4. Persists records to database.
        """
        if isinstance(file_path, RegulatorySourceMetadata):
            meta = file_path
            path = Path(source_meta)
        elif isinstance(source_meta, RegulatorySourceMetadata):
            meta = source_meta
            path = Path(file_path)
        else:
            path = Path(file_path)
            meta = source_meta

        source_meta = meta
        file_path = path

        with open(file_path, "rb") as f:
            file_bytes = f.read()
            source_meta.sha256_hash = hashlib.sha256(file_bytes).hexdigest()

        # 1. Structural extraction
        pages = RegulatoryExtractor.extract_from_file(file_path)

        # 2. Structural chunking
        chunks = RegulatoryChunker.chunk_pages(pages, source_meta)

        # 3. Embedding & FAISS indexing
        chunk_texts = [f"{c.chapter} {c.title}: {c.content}" for c in chunks]
        embeddings = self.embedder.embed_batch(chunk_texts)
        chunk_ids = [c.id for c in chunks]
        
        self.vector_store.add_chunks(chunk_ids, embeddings)

        for i, c in enumerate(chunks):
            c.embedding_id = self.vector_store.total_vectors - len(chunks) + i
            self.chunks_map[c.id] = c

        self.active_sources[source_meta.id] = source_meta
        self.retriever.update_chunks_map(chunks)

        # 4. Persist to DB if session provided
        if db is not None:
            from backend.app.models.models import RegulatorySource, RegulatoryRAGChunk
            try:
                # Upsert RegulatorySource
                src_rec = db.query(RegulatorySource).filter(RegulatorySource.id == source_meta.id).first()
                if not src_rec:
                    src_rec = RegulatorySource(
                        id=source_meta.id,
                        source_name=source_meta.source_name,
                        authority=source_meta.authority,
                        edition_year=source_meta.edition_year,
                        version=source_meta.version,
                        official_url_or_ref=source_meta.official_url_or_ref,
                        published_date=source_meta.publication_date,
                        effective_date=source_meta.effective_date,
                        is_active=source_meta.is_active,
                        file_path=str(file_path),
                        sha256_hash=source_meta.sha256_hash
                    )
                    db.add(src_rec)
                else:
                    src_rec.version = source_meta.version
                    src_rec.is_active = source_meta.is_active
                    src_rec.official_url_or_ref = source_meta.official_url_or_ref

                db.flush()

                # Upsert chunks
                for chunk in chunks:
                    chk_rec = db.query(RegulatoryRAGChunk).filter(RegulatoryRAGChunk.id == chunk.id).first()
                    if not chk_rec:
                        chk_rec = RegulatoryRAGChunk(
                            id=chunk.id,
                            source_id=source_meta.id,
                            chapter=chunk.chapter,
                            section=chunk.section,
                            clause_number=chunk.clause_number,
                            page_number=chunk.page_number,
                            title=chunk.title,
                            content=chunk.content,
                            token_count=chunk.token_count,
                            embedding_id=chunk.embedding_id,
                            is_ambiguous=chunk.is_ambiguous,
                            chunk_hash=chunk.chunk_hash
                        )
                        db.add(chk_rec)
                db.commit()
            except Exception as e:
                db.rollback()

        return {
            "source_id": source_meta.id,
            "source_name": source_meta.source_name,
            "chunks_ingested": len(chunks),
            "faiss_total_vectors": self.vector_store.total_vectors,
            "version": source_meta.version,
            "is_active": source_meta.is_active
        }

    def search_regulations(self, query: str, top_k: int = 4) -> List[GroundedClause]:
        """Runs hybrid dense/sparse retrieval."""
        if not self.chunks_map:
            self.initialize_default_sources()
        return self.retriever.retrieve(query, top_k=top_k)

    def evaluate_application(
        self,
        application_id: str,
        db: Session
    ) -> ComplianceEvaluationDossier:
        """
        Runs comprehensive regulatory RAG compliance evaluation across application documents.
        """
        if not self.chunks_map:
            self.initialize_default_sources(db=db)

        from backend.app.models.models import Application, ExtractedField, Document

        app = db.query(Application).filter(Application.id == application_id).first()
        if not app:
            raise ValueError(f"Application {application_id} not found")

        # Collect normalized extracted fields from all documents in this application
        facts: Dict[str, Any] = {
            "institution_name": app.institution_name,
            "program_name": app.program_name,
            "institution_type": app.institution_type,
            "state": app.state
        }

        docs = db.query(Document).filter(Document.application_id == application_id).all()
        for doc in docs:
            fields = db.query(ExtractedField).filter(ExtractedField.document_id == doc.id).all()
            for f in fields:
                if f.field_key:
                    facts[f.field_key] = f.field_value_normalized or f.field_value_raw
                    facts[f"{f.field_key}_confidence"] = f.confidence_score

        # Query relevant regulatory clauses for institutional approval
        queries = [
            "Minimum contiguous land extent urban rural requirement",
            "Fire Safety Certificate NOC unexpired active validity",
            "Student-Faculty Ratio SFR cadre composition",
            "Architect Council of Architecture COA registration master plan",
            "Multi-document land acreage reconciliation consistency"
        ]

        retrieved_clauses: List[GroundedClause] = []
        seen_clauses = set()

        for q in queries:
            clauses = self.search_regulations(q, top_k=2)
            for c in clauses:
                if c.clause_number not in seen_clauses:
                    retrieved_clauses.append(c)
                    seen_clauses.add(c.clause_number)

        # Get active source metadata
        default_meta = next(iter(self.active_sources.values()), None)

        dossier = ComplianceEvaluator.evaluate_application(
            application_id=application_id,
            facts=facts,
            grounded_clauses=retrieved_clauses,
            source_meta=default_meta
        )

        return dossier

    def query_regulations_grounded(
        self,
        query: str,
        top_k: int = 3,
        language: str = "en"
    ) -> Dict[str, Any]:
        """
        Answers inquiries with grounded evidence, verified citations, and anti-hallucination check.
        """
        if not self.chunks_map:
            self.initialize_default_sources()

        retrieved = self.search_regulations(query, top_k=top_k)
        explanation_data = GroundedExplainer.explain_query(query, retrieved, language=language)

        # Run strict citation validation
        citation_checks = CitationValidator.validate_citations(
            text_with_citations=explanation_data["answer"],
            indexed_chunks=self.chunks_map
        )

        return {
            "query": query,
            "answer": explanation_data["answer"],
            "citations": explanation_data["citations"],
            "retrieved_chunks": [c.model_dump() for c in retrieved],
            "citation_verification": [c.model_dump() for c in citation_checks],
            "vector_search_mode": "HYBRID_FAISS_BM25",
            "disclaimer": (
                "Statutory reference data only. TrustDoc does not invent legal obligations "
                "or simulate regulatory authority decrees."
            )
        }


# Global singleton
regulatory_rag_service = RegulatoryComplianceRAGService.get_instance()
