import json
from pathlib import Path
from typing import List, Tuple, Dict, Any, Optional
import faiss
import numpy as np

class FAISSVectorStore:
    """
    High-performance vector index using FAISS IndexFlatIP.
    Since embeddings are L2-normalized, inner-product distances correspond exactly
    to cosine similarity in [-1.0, 1.0].
    """

    def __init__(self, dimension: int = 384, storage_dir: Optional[Path | str] = None):
        self.dimension = dimension
        self.storage_dir = Path(storage_dir) if storage_dir else Path("backend/data/vector_store")
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        
        self.index_file = self.storage_dir / "faiss_regulatory.index"
        self.meta_file = self.storage_dir / "faiss_regulatory_meta.json"
        
        # Initialize or load FAISS IndexFlatIP
        self.index: faiss.IndexFlatIP = faiss.IndexFlatIP(self.dimension)
        # Mapping from FAISS vector integer ID -> chunk_id
        self.id_to_chunk_id: Dict[int, str] = {}
        # Mapping from chunk_id -> FAISS vector integer ID
        self.chunk_id_to_id: Dict[str, int] = {}

        if self.index_file.exists() and self.meta_file.exists():
            self.load()

    @property
    def total_vectors(self) -> int:
        return self.index.ntotal

    def add_chunks(self, chunk_ids: List[str], embeddings: np.ndarray):
        """
        Adds vectors to the FAISS index and records chunk ID mappings.
        embeddings must be a 2D float32 numpy array of shape (N, dimension).
        """
        if len(chunk_ids) == 0:
            return

        assert embeddings.shape[0] == len(chunk_ids), "Embedding count must match chunk count"
        assert embeddings.shape[1] == self.dimension, f"Embedding dim must be {self.dimension}"

        start_idx = self.index.ntotal
        self.index.add(embeddings.astype(np.float32))

        for i, chunk_id in enumerate(chunk_ids):
            faiss_id = start_idx + i
            self.id_to_chunk_id[faiss_id] = chunk_id
            self.chunk_id_to_id[chunk_id] = faiss_id

        self.save()

    def search(self, query_embedding: np.ndarray, top_k: int = 5) -> List[Tuple[str, float]]:
        """
        Searches the FAISS index with a 1D or 2D query embedding vector.
        Returns list of (chunk_id, cosine_similarity_score).
        """
        if self.index.ntotal == 0:
            return []

        if len(query_embedding.shape) == 1:
            q = np.expand_dims(query_embedding, axis=0).astype(np.float32)
        else:
            q = query_embedding.astype(np.float32)

        actual_k = min(top_k, self.index.ntotal)
        distances, indices = self.index.search(q, actual_k)

        results: List[Tuple[str, float]] = []
        for dist, idx in zip(distances[0], indices[0]):
            if idx in self.id_to_chunk_id:
                chunk_id = self.id_to_chunk_id[idx]
                results.append((chunk_id, float(dist)))

        return results

    def save(self):
        """Serializes FAISS binary index and JSON ID metadata to disk."""
        faiss.write_index(self.index, str(self.index_file))
        with open(self.meta_file, "w", encoding="utf-8") as f:
            json.dump({
                "id_to_chunk_id": {str(k): v for k, v in self.id_to_chunk_id.items()},
                "dimension": self.dimension
            }, f, indent=2)

    def load(self):
        """Loads FAISS index and JSON ID metadata from disk."""
        try:
            self.index = faiss.read_index(str(self.index_file))
            with open(self.meta_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                self.id_to_chunk_id = {int(k): v for k, v in data.get("id_to_chunk_id", {}).items()}
                self.chunk_id_to_id = {v: k for k, v in self.id_to_chunk_id.items()}
        except Exception:
            self.index = faiss.IndexFlatIP(self.dimension)
            self.id_to_chunk_id = {}
            self.chunk_id_to_id = {}

    def clear(self):
        """Resets the vector index."""
        self.index = faiss.IndexFlatIP(self.dimension)
        self.id_to_chunk_id = {}
        self.chunk_id_to_id = {}
        if self.index_file.exists():
            self.index_file.unlink(missing_ok=True)
        if self.meta_file.exists():
            self.meta_file.unlink(missing_ok=True)
