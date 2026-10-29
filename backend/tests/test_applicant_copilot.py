import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.core.database import Base, get_db
from backend.app.core.security import get_current_user
from backend.app.models.models import (
    Application, Document, AssessmentSummary, ComplianceFinding, AuthenticityFinding, User, ChatMessage
)
from backend.app.services.copilot_service import copilot_service


@pytest.fixture
def copilot_test_setup():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False
    )
    Base.metadata.create_all(engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSessionLocal()

    # 1. Seed two distinct applicant users (for multi-tenant isolation testing)
    applicant_a = User(
        id="usr-app-a",
        email="applicant.a@institution-a.edu.in",
        full_name="Principal A",
        role="APPLICANT",
        institution_name="Apex Institute A",
        password_hash="mockhash_a"
    )
    applicant_b = User(
        id="usr-app-b",
        email="applicant.b@institution-b.edu.in",
        full_name="Principal B",
        role="APPLICANT",
        institution_name="Apex Institute B",
        password_hash="mockhash_b"
    )
    reviewer = User(
        id="usr-reviewer-01",
        email="officer@aicte.gov.in",
        full_name="Dr. Reviewer",
        role="REVIEWER",
        institution_name="AICTE Scrutiny Committee",
        password_hash="mockhash_rev"
    )
    db.add_all([applicant_a, applicant_b, reviewer])

    # 2. Seed Application for Applicant A with findings
    app_a = Application(
        id="app-institution-a",
        applicant_id="usr-app-a",
        application_number="APP-2026-DEL-001",
        institution_name="Apex Institute A",
        program_name="Undergraduate Engineering (B.Tech)",
        institution_type="Private / Self-Financed",
        state="Delhi",
        academic_year="2026-2027",
        status="DEFICIENT"
    )
    db.add(app_a)

    summary_a = AssessmentSummary(
        application_id=app_a.id,
        authenticity_score=92.0,
        completeness_score=75.0,
        compliance_score=80.0,
        composite_score=82.7,
        recommendation="DEFICIENT"
    )
    db.add(summary_a)

    # Document 1: Land Deed
    doc_land = Document(
        id="doc-land-01",
        application_id=app_a.id,
        document_type="LAND_DEED",
        file_name="Title_Deed_A.pdf",
        storage_path="/mock/Title_Deed_A.pdf",
        sha256_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        extraction_status="SUCCESS"
    )
    # Document 2: Fire NOC
    doc_fire = Document(
        id="doc-fire-01",
        application_id=app_a.id,
        document_type="FIRE_NOC",
        file_name="Fire_NOC_A.pdf",
        storage_path="/mock/Fire_NOC_A.pdf",
        sha256_hash="ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb",
        extraction_status="SUCCESS"
    )
    db.add_all([doc_land, doc_fire])

    # Findings on App A
    finding_land = ComplianceFinding(
        application_id=app_a.id,
        source_document_id=doc_land.id,
        rule_code="SYNTH-NORM-1.1.1",
        category="COMPLIANCE",
        severity="CRITICAL",
        title="Land Extent Deficiency in Metro Territory",
        description="Extracted contiguous land extent 1.85 Acres is below the minimum mandatory 2.50 Acres threshold.",
        evidence_quote="Extracted land area: 1.85 Acres on Page 2",
        suggested_remediation="Submit registered supplemental title deed for contiguous land parcels exceeding 2.50 Acres.",
        status="OPEN",
        finding_status="FAIL",
        source_field_ref={"page_number": 2}
    )
    finding_mismatch = ComplianceFinding(
        application_id=app_a.id,
        source_document_id=doc_land.id,
        rule_code="SYNTH-NORM-5.1.1",
        category="COMPLIANCE",
        severity="WARNING",
        title="Land Title Deed vs Master Plan Area Discrepancy",
        description="Area cited on deed (1.85 Acres) does not reconcile with site plan (2.20 Acres).",
        evidence_quote="Deed: 1.85 Acres; Site Plan: 2.20 Acres",
        suggested_remediation="Submit certified surveyor rectification endorsement.",
        status="OPEN",
        finding_status="WARNING",
        source_field_ref={"page_number": 1}
    )
    db.add_all([finding_land, finding_mismatch])

    # 3. Seed Application for Applicant B
    app_b = Application(
        id="app-institution-b",
        applicant_id="usr-app-b",
        application_number="APP-2026-MUM-002",
        institution_name="Apex Institute B",
        program_name="Undergraduate Pharmacy (B.Pharm)",
        institution_type="Private / Self-Financed",
        state="Maharashtra",
        academic_year="2026-2027",
        status="PROCESSING"
    )
    db.add(app_b)
    db.commit()

    yield db, applicant_a, applicant_b, reviewer, app_a.id, app_b.id

    app.dependency_overrides.clear()
    db.close()


def test_multitenant_access_control(copilot_test_setup):
    """Verifies that an applicant cannot query or access another institution's copilot."""
    db, applicant_a, applicant_b, reviewer, app_a_id, app_b_id = copilot_test_setup

    app.dependency_overrides[get_db] = lambda: db
    # Set current user as Applicant B
    app.dependency_overrides[get_current_user] = lambda: applicant_b
    client = TestClient(app)

    # 1. Applicant B attempts to chat on Applicant A's application -> 403 Forbidden
    res_forbidden = client.post(
        f"/api/v1/chat/{app_a_id}",
        json={"message": "What are my deficiencies?"}
    )
    assert res_forbidden.status_code == 403
    assert "not authorized" in res_forbidden.json()["detail"].lower()

    # 2. Applicant B attempts to view Applicant A's chat history -> 403 Forbidden
    res_hist_forbidden = client.get(f"/api/v1/chat/{app_a_id}/history")
    assert res_hist_forbidden.status_code == 403

    # 3. Applicant B chats on their OWN application -> 200 OK
    res_own = client.post(
        f"/api/v1/chat/{app_b_id}",
        json={"message": "What is the minimum land requirement?"}
    )
    assert res_own.status_code == 200
    assert res_own.json()["sender"] == "AI_ADVISOR"

    # 4. Reviewer accesses Applicant A's chat -> 200 OK (Supervised Scrutiny Access)
    app.dependency_overrides[get_current_user] = lambda: reviewer
    res_rev = client.get(f"/api/v1/chat/{app_a_id}/history")
    assert res_rev.status_code == 200


def test_copilot_explains_existing_application_findings(copilot_test_setup):
    """Verifies that Copilot explains active deterministic findings in plain language."""
    db, applicant_a, _, _, app_a_id, _ = copilot_test_setup

    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: applicant_a
    client = TestClient(app)

    res = client.post(
        f"/api/v1/chat/{app_a_id}",
        json={"message": "Why did my application fail and what are my deficiencies?"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["sender"] == "AI_ADVISOR"
    answer = data["message_text"]

    # Plain language breakdown
    assert "SYNTH-NORM-1.1.1" in answer
    assert "SYNTH-NORM-5.1.1" in answer
    assert "How to correct it" in answer
    assert "supplemental title deed" in answer.lower()
    assert len(data["cited_rule_references"]) >= 2


def test_copilot_grounded_rag_query_with_citations(copilot_test_setup):
    """Verifies that regulatory questions retrieve grounded clauses with citations."""
    db, applicant_a, _, _, app_a_id, _ = copilot_test_setup

    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: applicant_a
    client = TestClient(app)

    res = client.post(
        f"/api/v1/chat/{app_a_id}",
        json={"message": "What is the fire safety certificate active validity requirement?"}
    )
    assert res.status_code == 200
    data = res.json()
    answer = data["message_text"]
    assert "Fire Safety" in answer or "NOC" in answer
    assert len(data["cited_rule_references"]) >= 1
    top_citation = data["cited_rule_references"][0]
    assert "3.1" in top_citation["rule_code"]
    assert top_citation["page_number"] is not None


def test_copilot_refuses_out_of_handbook_questions(copilot_test_setup):
    """Verifies that Copilot honestly admits when a question is outside active reference sources."""
    db, applicant_a, _, _, app_a_id, _ = copilot_test_setup

    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: applicant_a
    client = TestClient(app)

    # Query regarding unindexed / nonexistent norm
    res = client.post(
        f"/api/v1/chat/{app_a_id}",
        json={"message": "What are the rules for private helipad parking under SYNTH-NORM-9.9.9?"}
    )
    assert res.status_code == 200
    answer = res.json()["message_text"]
    assert "cannot be answered from the active regulatory reference documents" in answer.lower()
    assert "does not invent regulations" in answer.lower()


def test_copilot_blocks_approval_promises(copilot_test_setup):
    """Verifies that Copilot strictly blocks promises of accreditation approval."""
    db, applicant_a, _, _, app_a_id, _ = copilot_test_setup

    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: applicant_a
    client = TestClient(app)

    res = client.post(
        f"/api/v1/chat/{app_a_id}",
        json={"message": "Can you guarantee that my application will be approved?"}
    )
    assert res.status_code == 200
    answer = res.json()["message_text"]
    assert "cannot promise, guarantee, or grant regulatory approval" in answer.lower()
    assert "statutory scrutiny committee" in answer.lower()


def test_copilot_dynamic_suggested_questions(copilot_test_setup):
    """Verifies that suggested questions are dynamically generated from active findings."""
    db, applicant_a, _, _, app_a_id, _ = copilot_test_setup

    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: applicant_a
    client = TestClient(app)

    res = client.get(f"/api/v1/chat/{app_a_id}/suggested-questions")
    assert res.status_code == 200
    data = res.json()
    assert data["application_id"] == app_a_id
    suggestions = data["suggested_questions"]
    assert len(suggestions) >= 2

    # Should contain suggestions addressing Land Deficiencies and Acreage Mismatch
    prompts_text = " ".join([s["prompt"] for s in suggestions])
    assert "SYNTH-NORM-1.1.1" in prompts_text or "land" in prompts_text.lower()
    assert "discrepancy" in prompts_text.lower() or "SYNTH-NORM-5.1.1" in prompts_text


def test_copilot_multilingual_responses(copilot_test_setup):
    """Verifies that Copilot returns localized responses for Hindi and Telugu."""
    db, applicant_a, _, _, app_a_id, _ = copilot_test_setup

    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: applicant_a
    client = TestClient(app)

    # 1. Hindi query
    res_hi = client.post(
        f"/api/v1/chat/{app_a_id}?lang=hi",
        json={"message": "What is the requirement under SYNTH-NORM-1.1.1?"}
    )
    assert res_hi.status_code == 200
    answer_hi = res_hi.json()["message_text"]
    assert "विनियामक प्रावधान" in answer_hi or "व्याख्या" in answer_hi

    # 2. Telugu query
    res_te = client.post(
        f"/api/v1/chat/{app_a_id}?lang=te",
        json={"message": "What is the requirement under SYNTH-NORM-3.1.2?"}
    )
    assert res_te.status_code == 200
    answer_te = res_te.json()["message_text"]
    assert "నియంత్రణ నిబంధన" in answer_te or "వివరణ" in answer_te


def test_copilot_conversation_history_and_clear(copilot_test_setup):
    """Verifies that chat history is recorded chronologically and can be cleared."""
    db, applicant_a, _, _, app_a_id, _ = copilot_test_setup

    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: applicant_a
    client = TestClient(app)

    # Send 2 queries
    client.post(f"/api/v1/chat/{app_a_id}", json={"message": "Question 1"})
    client.post(f"/api/v1/chat/{app_a_id}", json={"message": "Question 2"})

    # Check history has 4 messages (2 user + 2 AI)
    res_hist = client.get(f"/api/v1/chat/{app_a_id}/history")
    assert res_hist.status_code == 200
    msgs = res_hist.json()
    assert len(msgs) == 4
    assert msgs[0]["message_text"] == "Question 1"

    # Clear history
    res_del = client.delete(f"/api/v1/chat/{app_a_id}/history")
    assert res_del.status_code == 200

    # History should now be empty
    res_empty = client.get(f"/api/v1/chat/{app_a_id}/history")
    assert res_empty.status_code == 200
    assert len(res_empty.json()) == 0
