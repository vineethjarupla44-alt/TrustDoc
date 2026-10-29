import io
import os
import shutil
import tempfile
import pytest
import numpy as np
import cv2
import fitz
from PIL import Image, ImageDraw
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.core.database import Base
from backend.app.models.models import Document, AuthenticityFinding, User, Application
from backend.app.services.authenticity.types import AuthenticityState, AuthenticityCheckResult
from backend.app.services.authenticity.checks import (
    HashCollisionChecker,
    FormatSignatureChecker,
    MetadataChecker,
    ELAChecker,
    OpenCVInspectionChecker,
    QRTrustChecker,
    DigitalSignatureChecker
)
from backend.app.services.authenticity.heatmap_generator import HeatmapGenerator
from backend.app.services.authenticity import AuthenticityScreeningService

@pytest.fixture
def temp_dir():
    d = tempfile.mkdtemp(prefix="test_auth_")
    yield Path(d)
    shutil.rmtree(d, ignore_errors=True)

@pytest.fixture
def mock_db():
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()

def _create_minimal_pdf(file_path: Path, producer: str = "Test Suite", creation_date: str = "D:20261020120000", mod_date: str = "D:20261020120000") -> Path:
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    page.insert_text((50, 50), "Government Regulatory Approval Certificate\nApex Institute of Technology")
    doc.set_metadata({
        "producer": producer,
        "creator": "Official Scanner Engine",
        "creationDate": creation_date,
        "modDate": mod_date
    })
    doc.save(str(file_path))
    doc.close()
    return file_path

def _create_minimal_png(file_path: Path, width: int = 300, height: int = 300, color=(240, 240, 240)) -> Path:
    img = Image.new("RGB", (width, height), color=color)
    draw = ImageDraw.Draw(img)
    draw.text((20, 20), "Authentic Regulatory Seal", fill=(10, 10, 10))
    img.save(str(file_path), "PNG")
    return file_path


# =========================================================================
# 1. Cryptographic Hash & Collision Tests
# =========================================================================
def test_hash_collision_checker_clean(temp_dir, mock_db):
    pdf_path = _create_minimal_pdf(temp_dir / "clean.pdf")
    res = HashCollisionChecker.check(pdf_path, current_doc_id="doc-123", db=mock_db)
    
    assert res.state == AuthenticityState.VERIFIED
    assert len(res.evidence["sha256"]) == 64
    assert len(res.evidence["md5"]) == 32
    assert res.evidence["collision_count"] == 0
    assert len(res.can_establish) > 0
    assert len(res.cannot_establish) > 0

def test_hash_collision_checker_duplicate_detection(temp_dir, mock_db):
    pdf_path = _create_minimal_pdf(temp_dir / "duplicate.pdf")
    
    # Calculate sha256 to seed duplicate in mock_db
    import hashlib
    with open(pdf_path, "rb") as f:
        sha256 = hashlib.sha256(f.read()).hexdigest()

    # Create dummy user & applications
    user = User(email="test@inst.edu", password_hash="hash", full_name="Officer", role="APPLICANT")
    mock_db.add(user)
    mock_db.flush()

    app1 = Application(applicant_id=user.id, application_number="APP-2026-001")
    app2 = Application(applicant_id=user.id, application_number="APP-2026-002")
    mock_db.add_all([app1, app2])
    mock_db.flush()

    # Pre-existing document in DB
    existing_doc = Document(
        id="doc-prior-999",
        application_id=app1.id,
        document_type="LAND_DEED",
        file_name="prior_land_deed.pdf",
        storage_path=str(pdf_path),
        sha256_hash=sha256
    )
    mock_db.add(existing_doc)
    mock_db.commit()

    # Now screen incoming document under app2
    res = HashCollisionChecker.check(pdf_path, current_doc_id="doc-incoming-100", db=mock_db)
    
    assert res.state == AuthenticityState.SUSPICIOUS_INDICATOR
    assert res.evidence["collision_count"] == 1
    assert res.evidence["collision_details"][0]["document_id"] == "doc-prior-999"


# =========================================================================
# 2. File Signature & Container Integrity Tests
# =========================================================================
def test_format_signature_checker_valid_pdf(temp_dir):
    pdf_path = _create_minimal_pdf(temp_dir / "valid.pdf")
    res = FormatSignatureChecker.check(pdf_path)
    assert res.state == AuthenticityState.VERIFIED
    assert res.evidence["declared_extension"] == "pdf"
    assert res.evidence["detected_format"] == "pdf"
    assert res.evidence["eof_marker_found"] is True

def test_format_signature_checker_extension_spoofing(temp_dir):
    # Create valid PDF bytes but save with .png extension
    pdf_path = _create_minimal_pdf(temp_dir / "spoofed.png")
    res = FormatSignatureChecker.check(pdf_path)
    
    assert res.state == AuthenticityState.MISMATCH
    assert "extension is '.png'" in res.explanation
    assert res.anomaly_score >= 90.0

def test_format_signature_checker_truncated_container(temp_dir):
    # Create a corrupted PDF with no %%EOF
    bad_pdf = temp_dir / "corrupted.pdf"
    with open(bad_pdf, "wb") as f:
        f.write(b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n")  # Omit %%EOF
    
    res = FormatSignatureChecker.check(bad_pdf)
    assert res.state == AuthenticityState.MISMATCH
    assert "missing required '%%EOF'" in res.explanation


# =========================================================================
# 3. Metadata Analysis Tests
# =========================================================================
def test_metadata_checker_clean(temp_dir):
    pdf_path = _create_minimal_pdf(temp_dir / "clean_meta.pdf", producer="Scanner HP Enterprise", creation_date="D:20261020100000", mod_date="D:20261020100000")
    res = MetadataChecker.check(pdf_path)
    assert res.state == AuthenticityState.VERIFIED
    assert res.anomaly_score < 20.0

def test_metadata_checker_suspicious_editor_tool(temp_dir):
    # PDF authored with Canva / Photoshop
    pdf_path = _create_minimal_pdf(temp_dir / "canva_doc.pdf", producer="Canva PDF Exporter v2.1")
    res = MetadataChecker.check(pdf_path)
    
    assert res.state == AuthenticityState.SUSPICIOUS_INDICATOR
    assert res.evidence["detected_tool"] == "Canva"
    assert "graphic editor" in res.explanation

def test_metadata_checker_chronological_paradox(temp_dir):
    # ModDate precedes CreationDate
    pdf_path = _create_minimal_pdf(
        temp_dir / "paradox.pdf",
        producer="Test Engine",
        creation_date="D:20261025180000",  # Created at 18:00
        mod_date="D:20261020100000"       # Modified 5 days EARLIER!
    )
    res = MetadataChecker.check(pdf_path)
    assert res.state == AuthenticityState.MISMATCH
    assert "precedes Creation timestamp" in res.explanation


# =========================================================================
# 4. Error Level Analysis (ELA) & Genuine Heatmap Tests
# =========================================================================
def test_ela_checker_uniform_image(temp_dir):
    # Uniform solid image produces low compression difference
    img_path = temp_dir / "uniform.png"
    img = Image.new("RGB", (400, 400), color=(220, 220, 220))
    img.save(str(img_path))

    res, diff_arr, score = ELAChecker.check(img_path)
    assert res.state == AuthenticityState.VERIFIED
    assert score < 35.0

    # Ensure HeatmapGenerator does NOT generate heatmap for uniform image
    out_map = temp_dir / "uniform_heatmap.png"
    heatmap_info = HeatmapGenerator.generate_ela_heatmap(img_path, out_map, diff_arr, score)
    assert heatmap_info["generated"] is False
    assert not out_map.exists()

def test_ela_checker_spliced_image_generates_genuine_heatmap(temp_dir):
    # High frequency alternating pattern with intense localized noise
    img = np.zeros((400, 400, 3), dtype=np.uint8)
    img[::2, ::2] = [255, 0, 0]
    img[1::2, 1::2] = [0, 255, 0]
    img[50:350, 50:350] = np.random.randint(0, 255, (300, 300, 3), dtype=np.uint8)

    img_path = temp_dir / "spliced.png"
    cv2.imwrite(str(img_path), img)

    res, diff_arr, score = ELAChecker.check(img_path)
    assert score > 35.0
    assert res.state in [AuthenticityState.SUSPICIOUS_INDICATOR, AuthenticityState.NEEDS_MANUAL_REVIEW]

    # Now verify HeatmapGenerator generates a real JET overlay artifact
    out_map = temp_dir / "spliced_heatmap.png"
    heatmap_info = HeatmapGenerator.generate_ela_heatmap(img_path, out_map, diff_arr, score)
    
    assert heatmap_info["generated"] is True
    assert out_map.exists()
    assert len(heatmap_info["regions"]) > 0
    # Verify the generated heatmap image is a valid PNG
    hm_img = Image.open(out_map)
    assert hm_img.size == (400, 400)


# =========================================================================
# 5. OpenCV Sensor & Feature Inspection Tests
# =========================================================================
def test_opencv_checker_clean_document(temp_dir):
    pdf_path = _create_minimal_pdf(temp_dir / "cv_clean.pdf")
    res = OpenCVInspectionChecker.check(pdf_path)
    assert res.state == AuthenticityState.VERIFIED
    assert "laplacian_variance" in res.evidence
    assert res.evidence["cloned_feature_matches"] < 15

def test_opencv_checker_copy_move_cloning(temp_dir):
    # Create an image with identical cloned patches placed at distant coordinates
    canvas = np.full((500, 500), 245, dtype=np.uint8)
    
    # Draw complex distinctive pattern (emulating an institutional rubber seal)
    stamp = np.zeros((80, 80), dtype=np.uint8)
    cv2.circle(stamp, (40, 40), 30, 255, 3)
    cv2.putText(stamp, "SEAL", (10, 45), cv2.FONT_HERSHEY_SIMPLEX, 0.7, 255, 2)
    cv2.rectangle(stamp, (5, 5), (75, 75), 255, 2)

    # Paste stamp at top-left and bottom-right (duplicate clone)
    canvas[50:130, 50:130] = stamp
    canvas[350:430, 350:430] = stamp
    canvas[50:130, 350:430] = stamp

    img_path = temp_dir / "cloned_stamp.png"
    cv2.imwrite(str(img_path), canvas)

    res = OpenCVInspectionChecker.check(img_path)
    assert res.evidence["cloned_feature_matches"] > 5
    assert len(res.can_establish) > 0


# =========================================================================
# 6. QR-Code Unsimulated Guardrail Tests
# =========================================================================
def _make_qr_image(text: str, output_path: Path) -> Path:
    enc = cv2.QRCodeEncoder.create()
    matrix = enc.encode(text)
    scale = 8
    qr_scaled = cv2.resize(matrix, (matrix.shape[1] * scale, matrix.shape[0] * scale), interpolation=cv2.INTER_NEAREST)
    canvas = np.full((qr_scaled.shape[0] + 80, qr_scaled.shape[1] + 80), 255, dtype=np.uint8)
    canvas[40:40+qr_scaled.shape[0], 40:40+qr_scaled.shape[1]] = qr_scaled
    cv2.imwrite(str(output_path), canvas)
    return output_path

def test_qr_checker_no_qr(temp_dir):
    pdf_path = _create_minimal_pdf(temp_dir / "no_qr.pdf")
    res = QRTrustChecker.check(pdf_path)
    assert res.state == AuthenticityState.UNAVAILABLE
    assert res.evidence["qr_detected"] is False

def test_qr_checker_statutory_url_without_enrolled_key_requires_manual_review(temp_dir):
    # Embed QR code pointing to official government portal
    # ComplianceAI MUST NOT simulate verification: returns NEEDS_MANUAL_REVIEW
    qr_path = _make_qr_image("https://facilities.aicte-india.org/verify/doc12345", temp_dir / "statutory_qr.png")

    res = QRTrustChecker.check(qr_path)
    assert res.state == AuthenticityState.NEEDS_MANUAL_REVIEW
    assert "aicte-india.org" in res.explanation
    assert "does not simulate live government portal queries" in res.explanation

def test_qr_checker_untrusted_domain_suspicious(temp_dir):
    qr_path = _make_qr_image("http://fake-certificates-online.xyz/cert?id=999", temp_dir / "untrusted_qr.png")

    res = QRTrustChecker.check(qr_path)
    assert res.state == AuthenticityState.SUSPICIOUS_INDICATOR
    assert "untrusted or non-statutory third-party web domain" in res.explanation


# =========================================================================
# 7. Digital Signature (PKI) Unsimulated Guardrail Tests
# =========================================================================
def test_digital_sig_unsigned_pdf(temp_dir):
    pdf_path = _create_minimal_pdf(temp_dir / "unsigned.pdf")
    res = DigitalSignatureChecker.check(pdf_path)
    assert res.state == AuthenticityState.UNAVAILABLE
    assert res.evidence["digital_signature_present"] is False

def test_digital_sig_untrusted_root_requires_manual_review(temp_dir):
    # Create PDF with valid ByteRange and detached signature container,
    # but signed by an unverified private cert (NOT in statutory root store)
    sig_pdf = temp_dir / "self_signed.pdf"
    
    # We construct a synthetic PDF with ByteRange dictionary
    header = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
    body = (
        b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R >>\nendobj\n"
        b"4 0 obj\n<< /Type /Sig /Filter /Adobe.PPKLite /SubFilter /adbe.pkcs7.detached "
        b"/Name (Self-Signed College Principal) /ByteRange [0 200 250 100] >>\nendobj\n"
    )
    trailer = b"trailer\n<< /Root 1 0 R >>\n%%EOF\n"
    full_bytes = header + body + trailer

    with open(sig_pdf, "wb") as f:
        f.write(full_bytes)

    res = DigitalSignatureChecker.check(sig_pdf)
    
    # STRICT GUARDRAIL: Must NOT claim VERIFIED! Must return NEEDS_MANUAL_REVIEW
    assert res.state == AuthenticityState.NEEDS_MANUAL_REVIEW
    assert "Self-Signed College Principal" in res.evidence["signer_identity"]
    assert "issuing Certificate Authority is not in the enrolled statutory trust store" in res.explanation

def test_digital_sig_appended_bytes_mismatch(temp_dir):
    # PDF with trailing bytes appended after signature byte range
    tampered_pdf = temp_dir / "tampered_sig.pdf"
    
    # ByteRange declares covering 300 bytes, but file has 800 bytes!
    header = b"%PDF-1.4\n"
    sig_obj = (
        b"1 0 obj\n<< /Type /Sig /ByteRange [ 0 100 150 150 ] "
        b"/SubFilter /adbe.pkcs7.detached /Name (Auditor) >>\nendobj\n"
    )
    tampered_payload = b"X" * 600 + b"\n%%EOF\n"
    with open(tampered_pdf, "wb") as f:
        f.write(header + sig_obj + tampered_payload)

    res = DigitalSignatureChecker.check(tampered_pdf)
    assert res.state == AuthenticityState.MISMATCH
    assert "Byte-range mismatch detected" in res.explanation


# =========================================================================
# 8. Epistemic Limits & Master Dossier Orchestrator Tests
# =========================================================================
def test_epistemic_bounds_completeness(temp_dir, mock_db):
    pdf_path = _create_minimal_pdf(temp_dir / "epistemic.pdf")
    dossier = AuthenticityScreeningService.run_all_checks(
        file_path=pdf_path,
        document_id="test-doc-1",
        db=mock_db
    )

    assert len(dossier.checks) == 7
    for check in dossier.checks:
        assert isinstance(check.can_establish, list)
        assert len(check.can_establish) >= 1, f"{check.check_code} has empty can_establish"
        assert isinstance(check.cannot_establish, list)
        assert len(check.cannot_establish) >= 1, f"{check.check_code} has empty cannot_establish"
        assert len(check.explanation) > 10

    assert "do not independently constitute definitive legal proof" in dossier.disclaimer
    assert dossier.overall_verdict in [AuthenticityState.VERIFIED, AuthenticityState.NEEDS_MANUAL_REVIEW]

def test_screen_document_persistence(temp_dir, mock_db):
    pdf_path = _create_minimal_pdf(temp_dir / "persist.pdf")
    
    user = User(email="screen@inst.edu", password_hash="hash", full_name="Dean", role="APPLICANT")
    mock_db.add(user)
    mock_db.flush()

    app = Application(applicant_id=user.id, application_number="APP-PERSIST-01")
    mock_db.add(app)
    mock_db.flush()

    doc = Document(
        id="doc-persist-77",
        application_id=app.id,
        document_type="FIRE_NOC",
        file_name="fire_noc.pdf",
        storage_path=str(pdf_path),
        sha256_hash=""
    )
    mock_db.add(doc)
    mock_db.commit()

    result = AuthenticityScreeningService.screen_document(
        file_path=pdf_path,
        document_id=doc.id,
        db=mock_db
    )

    assert result["document_id"] == "doc-persist-77"
    assert len(result["sha256_hash"]) == 64
    assert len(result["screening_results"]) == 7
    assert "disclaimer" in result

    # Verify persisted in SQLite mock_db
    persisted = mock_db.query(AuthenticityFinding).filter(AuthenticityFinding.document_id == doc.id).first()
    assert persisted is not None
    assert persisted.screening_results is not None
    assert len(persisted.screening_results) == 7
