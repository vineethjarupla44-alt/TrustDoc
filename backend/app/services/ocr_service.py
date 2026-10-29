import fitz  # PyMuPDF
from pathlib import Path
from typing import Any

class OCRService:
    @staticmethod
    def extract_document_text(file_path: Path | str) -> dict[str, Any]:
        """
        Extracts textual content, page metadata, text blocks with bounding boxes,
        and OCR confidence from PDF, JPG, and PNG documents.
        Supports hybrid OCR routing (PyMuPDF for digital text, raster fallback for scans).
        """
        file_path = Path(file_path)
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        pages_data = []
        full_text_parts = []
        scanned_pages_count = 0
        
        try:
            doc = fitz.open(str(file_path))
            total_pages = len(doc)
            
            for page_num in range(total_pages):
                page = doc[page_num]
                text = page.get_text("text")
                blocks = page.get_text("blocks")  # (x0, y0, x1, y1, text, block_no, block_type)
                
                parsed_blocks = []
                for b in blocks:
                    if len(b) >= 5 and b[4].strip():
                        parsed_blocks.append({
                            "bbox": [round(b[0], 2), round(b[1], 2), round(b[2], 2), round(b[3], 2)],
                            "text": b[4].strip()
                        })

                # Scanned page detection heuristic (< 30 characters of digital text)
                is_scanned = len(text.strip()) < 30
                page_confidence = 0.98 if not is_scanned else 0.82
                page_engine = "PYMUPDF"

                if is_scanned:
                    scanned_pages_count += 1
                    # Attempt Tesseract fallback if installed
                    try:
                        import pytesseract
                        from PIL import Image
                        pix = page.get_pixmap(dpi=200)
                        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                        tess_text = pytesseract.image_to_string(img)
                        if len(tess_text.strip()) > len(text.strip()):
                            text = tess_text
                            page_engine = "TESSERACT_OCR"
                            page_confidence = 0.88
                    except Exception:
                        # Tesseract binary not present or failed; retain PyMuPDF text & note scan
                        page_engine = "PYMUPDF_SCANNED_IMAGE"
                        page_confidence = 0.75 if text.strip() else 0.50
                
                full_text_parts.append(text)
                pages_data.append({
                    "page_number": page_num + 1,
                    "text": text,
                    "blocks": parsed_blocks,
                    "is_scanned": is_scanned,
                    "engine": page_engine,
                    "confidence": page_confidence
                })
            
            combined_text = "\n\n".join(full_text_parts)
            doc.close()

            overall_engine = "PYMUPDF" if scanned_pages_count == 0 else ("TESSERACT_HYBRID" if "TESSERACT_OCR" in [p["engine"] for p in pages_data] else "PYMUPDF_HYBRID")
            avg_confidence = round(sum(p["confidence"] for p in pages_data) / max(1, len(pages_data)), 2)

            return {
                "success": True,
                "total_pages": total_pages,
                "full_text": combined_text,
                "pages": pages_data,
                "scanned_pages_count": scanned_pages_count,
                "engine": overall_engine,
                "confidence_score": avg_confidence
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "total_pages": 0,
                "full_text": "",
                "pages": [],
                "scanned_pages_count": 0,
                "engine": "FAILED",
                "confidence_score": 0.0
            }

    @staticmethod
    def render_page_to_image(file_path: Path | str, page_number: int = 1, output_path: Path | str = None) -> str:
        """Renders a document page to a PNG image for visual inspection & forensics."""
        file_path = Path(file_path)
        doc = fitz.open(str(file_path))
        if page_number > len(doc) or page_number < 1:
            page_number = 1
        page = doc[page_number - 1]
        pix = page.get_pixmap(dpi=150)
        
        if not output_path:
            output_path = file_path.with_suffix(f".page_{page_number}.png")
        
        pix.save(str(output_path))
        doc.close()
        return str(output_path)

