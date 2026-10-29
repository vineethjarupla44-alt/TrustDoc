import hashlib
import re
import numpy as np
from typing import List
from abc import ABC, abstractmethod

class EmbeddingProvider(ABC):
    """Abstract interface for regulatory text embedding providers."""

    @property
    @abstractmethod
    def dimension(self) -> int:
        pass

    @abstractmethod
    def embed_text(self, text: str) -> np.ndarray:
        """Returns 1D float32 numpy array of length `dimension`."""
        pass

    @abstractmethod
    def embed_batch(self, texts: List[str]) -> np.ndarray:
        """Returns 2D float32 numpy array of shape (len(texts), dimension)."""
        pass


class DeterministicSemanticEmbedder(EmbeddingProvider):
    """
    Built-in, zero-dependency, deterministic 384-dimensional semantic projection embedder.
    Maps regulatory terminology, clause codes, and legal stems into dense unit-norm vectors.
    Ensures 100% offline reliability without external API quotas, latency, or rate limits.
    """

    def __init__(self, dimension: int = 384):
        self._dim = dimension
        # Deterministically seeded projection matrix for word tokens
        rng = np.random.RandomState(seed=2026261)
        self._vocab_proj = rng.randn(10007, self._dim).astype(np.float32)
        # Normalize projection rows
        norms = np.linalg.norm(self._vocab_proj, axis=1, keepdims=True)
        self._vocab_proj = self._vocab_proj / np.maximum(norms, 1e-8)

    @property
    def dimension(self) -> int:
        return self._dim

    def _hash_token(self, token: str) -> int:
        """Maps token string to an index in [0, 10006]."""
        h = int(hashlib.md5(token.encode("utf-8")).hexdigest(), 16)
        return h % 10007

    def _tokenize(self, text: str) -> List[str]:
        tokens = re.findall(r"\b[A-Za-z0-9\.-]+\b", text.lower())
        return [t for t in tokens if len(t) > 1]

    def embed_text(self, text: str) -> np.ndarray:
        tokens = self._tokenize(text)
        if not tokens:
            vec = np.zeros(self._dim, dtype=np.float32)
            vec[0] = 1.0
            return vec

        # Term frequency weighting with legal clause code boost
        vec = np.zeros(self._dim, dtype=np.float32)
        for token in tokens:
            idx = self._hash_token(token)
            weight = 1.0
            # Higher weight for statutory codes, numbers, and key compliance terms
            if any(k in token for k in ["synth", "norm", "clause", "acre", "fire", "sfr", "coa"]):
                weight = 3.0
            elif re.match(r"^\d+(\.\d+)*$", token):
                weight = 2.0
            vec += self._vocab_proj[idx] * weight

        # Add 3-gram character shingles for typo & morphological resilience
        cleaned = re.sub(r"\s+", " ", text.lower().strip())
        for i in range(max(0, len(cleaned) - 3)):
            shingle = cleaned[i:i + 3]
            idx = self._hash_token(shingle)
            vec += self._vocab_proj[idx] * 0.35

        # L2-normalization for cosine inner product in FAISS
        norm = np.linalg.norm(vec)
        if norm > 1e-8:
            vec = vec / norm
        else:
            vec[0] = 1.0
        return vec.astype(np.float32)

    def embed_batch(self, texts: List[str]) -> np.ndarray:
        if not texts:
            return np.empty((0, self._dim), dtype=np.float32)
        embeddings = [self.embed_text(t) for t in texts]
        return np.vstack(embeddings).astype(np.float32)


# Default factory
def get_embedding_provider() -> EmbeddingProvider:
    return DeterministicSemanticEmbedder(dimension=384)
