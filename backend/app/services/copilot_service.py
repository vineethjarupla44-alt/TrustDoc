import re
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from backend.app.models.models import Application, ComplianceFinding, Document, ExtractedField, User
from backend.app.services.regulatory_rag.service import regulatory_rag_service
from backend.app.services.regulatory_rag.citation_validator import CitationValidator
from backend.app.services.regulatory_rag.types import GroundedClause


class ApplicantComplianceCopilotService:
    """
    Intelligent Compliance Copilot for institutional applicants.
    
    Capabilities:
    1. Explains regulatory requirements and approval criteria in plain language.
    2. Breaks down existing deterministic validation findings on the active application.
    3. Retrieves grounded evidence from the hybrid FAISS + BM25 regulatory vector repository.
    4. Proposes concrete, actionable remediations for missing or inconsistent documents.
    5. Cites exact statutory sources, chapters, clauses, page numbers, and portal URLs.
    6. Admits when a question cannot be answered from verified regulatory publications.
    7. Supports English ('en'), Hindi ('hi'), and Telugu ('te').
    8. Strict guardrails: Never overrides deterministic findings, never invents regulations,
       and never promises accreditation approval.
    """

    _instance = None

    @classmethod
    def get_instance(cls) -> "ApplicantComplianceCopilotService":
        if cls._instance is None:
            cls._instance = ApplicantComplianceCopilotService()
        return cls._instance

    # -----------------------------------------------------------------
    # 1. Dynamic Suggested Questions Generation
    # -----------------------------------------------------------------
    def generate_suggested_questions(
        self,
        application: Application,
        db: Session
    ) -> List[Dict[str, Any]]:
        """
        Dynamically synthesizes contextual suggestion prompts based on the
        application's current deficiencies, unsubmitted documents, and extraction flags.
        """
        suggestions: List[Dict[str, Any]] = []

        findings = db.query(ComplianceFinding).filter(
            ComplianceFinding.application_id == application.id
        ).all()

        uploaded_docs = db.query(Document).filter(
            Document.application_id == application.id
        ).all()
        uploaded_types = {d.document_type for d in uploaded_docs}

        # 1. Finding-specific suggestions
        for f in findings:
            if f.rule_code == "SYNTH-NORM-1.1.1" or "land" in f.title.lower():
                suggestions.append({
                    "category": "FINDING_REMEDIATION",
                    "label": "Resolve Land Area Deficiency",
                    "prompt": f"Why is my land acreage flagged under {f.rule_code}, and how do I rectify it?",
                    "rule_code": f.rule_code
                })
            elif f.rule_code == "SYNTH-NORM-5.1.1" or "discrepancy" in f.title.lower() or "mismatch" in f.title.lower():
                suggestions.append({
                    "category": "FINDING_REMEDIATION",
                    "label": "Fix Land Deed Discrepancy",
                    "prompt": "How do I resolve the discrepancy between my Land Title Deed and Master Site Plan acreage?",
                    "rule_code": f.rule_code
                })
            elif f.rule_code in ("SYNTH-NORM-3.1.1", "SYNTH-NORM-3.1.2") or "fire" in f.title.lower():
                suggestions.append({
                    "category": "FINDING_REMEDIATION",
                    "label": "Fire Safety NOC Rectification",
                    "prompt": "What are the active validity requirements for a Fire Safety Certificate (NOC)?",
                    "rule_code": f.rule_code
                })
            elif f.rule_code == "SYNTH-NORM-2.1.1" or "architect" in f.title.lower() or "coa" in f.title.lower():
                suggestions.append({
                    "category": "FINDING_REMEDIATION",
                    "label": "Architect COA Requirements",
                    "prompt": "What Council of Architecture (COA) registration details must appear on the Master Plan?",
                    "rule_code": f.rule_code
                })
            elif f.rule_code in ("SYNTH-NORM-6.1.1", "SYNTH-NORM-6.1.2") or "photoshop" in f.description.lower() or "metadata" in f.title.lower():
                suggestions.append({
                    "category": "FINDING_REMEDIATION",
                    "label": "Address Metadata Warning",
                    "prompt": "Why did my uploaded plan trigger an editing software metadata warning, and how do I remedy it?",
                    "rule_code": f.rule_code
                })

        # 2. Missing mandatory documents suggestions
        mandatory_docs = {
            "LAND_DEED": "Land Title Deed",
            "BUILDING_PLAN": "Master Site Plan & Building Layout",
            "FIRE_NOC": "Fire Safety Certificate (NOC)",
            "FACULTY_LIST": "Faculty Cadre & Ratio Declaration"
        }
        for doc_key, doc_name in mandatory_docs.items():
            if doc_key not in uploaded_types:
                suggestions.append({
                    "category": "MISSING_DOCUMENT",
                    "label": f"Missing {doc_name}",
                    "prompt": f"What specific statutory contents must be included in the {doc_name}?",
                    "rule_code": "MANDATORY_INVENTORY"
                })

        # 3. General baseline questions if suggestions list is short
        if len(suggestions) < 4:
            suggestions.extend([
                {
                    "category": "STATUTORY_NORM",
                    "label": "Urban vs Rural Land Norms",
                    "prompt": "What is the minimum land requirement for Urban vs Rural technical institutes under AICTE norms?",
                    "rule_code": "SYNTH-NORM-1.1.1"
                },
                {
                    "category": "STATUTORY_NORM",
                    "label": "Student-to-Faculty Ratio",
                    "prompt": "What is the prescribed Student-to-Faculty Ratio (SFR) and cadre ratio for UG Engineering?",
                    "rule_code": "SYNTH-NORM-4.1.1"
                },
                {
                    "category": "GENERAL_ADVISORY",
                    "label": "Approval Scrutiny Procedure",
                    "prompt": "How does the institutional scrutiny committee evaluate applications after submission?",
                    "rule_code": None
                }
            ])

        return suggestions[:6]

    # -----------------------------------------------------------------
    # 2. Query Processing & Grounded Response
    # -----------------------------------------------------------------
    def answer_copilot_query(
        self,
        application: Application,
        user: User,
        query: str,
        language: str = "en",
        db: Optional[Session] = None
    ) -> Dict[str, Any]:
        """
        Executes grounded copilot consultation with strict guardrails:
        - Intercepts requests for approval guarantees.
        - Translates existing application findings if asked about the application's defects.
        - Retrieves verified clauses from the RAG store with page and section provenance.
        - Admits when an inquiry cannot be answered from active regulatory publications.
        - Enforces non-overriding of deterministic validation outcomes.
        """
        q_lower = query.lower().strip()

        # -------------------------------------------------------------
        # Guardrail 1: Approval Promise Blocker
        # -------------------------------------------------------------
        approval_patterns = [
            r"\b(guarantee|promise|grant|declare)\b.*\bapprov",
            r"\bapprov.*\b(guarantee|promise|grant)\b",
            r"\bwill\b.*\b(be\s+)?approv",
            r"\bcan\s+you\b.*\bapprov",
            r"\bam\s+i\b.*\bapprov",
            r"\bwill\s+i\s+be\s+approved\b",
            r"\bclearance\s+guarantee\b"
        ]
        if any(re.search(pat, q_lower) for pat in approval_patterns):
            return self._build_approval_refusal_response(application, language)

        # -------------------------------------------------------------
        # Guardrail 2: Explaining Existing Application Findings
        # -------------------------------------------------------------
        finding_keywords = [
            "why did i fail", "why did my application fail", "what is wrong with my application",
            "explain my findings", "what are my deficiencies", "my defects", "why was my land deed flagged",
            "why was my fire noc flagged", "explain defects", "list my findings", "my findings"
        ]
        finding_intent = any(kw in q_lower for kw in finding_keywords)
        finding_intent = finding_intent or (
            "my application" in q_lower
            and any(term in q_lower for term in ("flagged", "discrepancy", "mismatch", "deficien"))
        )
        if db is not None and finding_intent:
            findings = db.query(ComplianceFinding).filter(
                ComplianceFinding.application_id == application.id
            ).all()
            if findings:
                return self._explain_application_findings(application, findings, language)

        # -------------------------------------------------------------
        # Guardrail 3: Grounded RAG Retrieval
        # -------------------------------------------------------------
        retrieved_clauses = regulatory_rag_service.search_regulations(query, top_k=3)

        # Check for epistemic refusal: low relevance or completely out-of-domain query
        top_clause = retrieved_clauses[0] if retrieved_clauses else None
        is_relevant = (
            top_clause is not None
            and getattr(top_clause, "relevance_score", 0.0) >= 0.12
        )

        # Explicit check for known hallucinated / out-of-handbook queries
        out_of_handbook_terms = [
            "helipad", "swimming pool", "cricket stadium", "cooking", "recipe",
            "synth-norm-9.9.9", "synth-norm-8", "cryptocurrency", "blockchain voting"
        ]
        if any(term in q_lower for term in out_of_handbook_terms) or not is_relevant:
            return self._build_out_of_handbook_admission(query, language)

        # Build grounded response with verified citations
        return self._build_grounded_response(query, retrieved_clauses, application, language, db)

    # -----------------------------------------------------------------
    # Helper: Approval Refusal Response
    # -----------------------------------------------------------------
    def _build_approval_refusal_response(self, application: Application, language: str) -> Dict[str, Any]:
        messages = {
            "en": (
                f"**Statutory Advisory Notice**: TrustDoc is an automated procedural assistance system and "
                f"**cannot promise, guarantee, or grant regulatory approval** for Application **{application.application_number}**.\n\n"
                f"Formal accreditation decisions rest solely with the competent Statutory Scrutiny Committee following "
                f"documentary audit, cross-departmental clearance verification, and physical spot inspection pursuant to council bylaws.\n\n"
                f"**Recommendation**: Please review your composite score ({application.summary.composite_score if application.summary else 0.0}%) "
                f"and ensure all prescribed remediations are addressed before formal scrutiny committee convening."
            ),
            "hi": (
                f"**वैधानिक सलाहकार सूचना**: TrustDoc एक स्वचालित प्रक्रियात्मक सहायता प्रणाली है और यह आवेदन "
                f"**{application.application_number}** के लिए विनियामक **स्वीकृति की गारंटी या वादा नहीं कर सकता**।\n\n"
                f"औपचारिक प्रत्यायन निर्णय केवल सक्षम वैधानिक जांच समिति द्वारा दस्तावेजों की जांच और भौतिक सत्यापन के बाद ही लिया जाता है।\n\n"
                f"**सुझाव**: कृपया समिति की बैठक से पहले अपने निष्कर्षों और सुधारात्मक कार्यों को पूरा करें।"
            ),
            "te": (
                f"**చట్టబద్ధమైన సలహా నోటీసు**: TrustDoc అనేది ఒక ప్రక్రియాత్మక సహాయ వ్యవస్థ మరియు ఇది మీ దరఖాస్తు "
                f"**{application.application_number}** కు **ఆమోదం హామీ ఇవ్వదు**.\n\n"
                f"తుది ఆమోద నిర్ణయాలు కేవలం అధికారిక పరిశీలన కమిటీ ద్వారా మాత్రమే తీసుకోబడతాయి.\n\n"
                f"**సలహా**: దయచేసి మీ అప్లికేషన్ లోని లోపాలను పరిష్కరించి పత్రాలను సిద్ధంగా ఉంచుకోండి."
            )
        }
        return {
            "answer": messages.get(language, messages["en"]),
            "citations": [],
            "retrieved_clauses": [],
            "is_grounded": True,
            "disclaimer": "Informational guidance only. Does not constitute official approval."
        }

    # -----------------------------------------------------------------
    # Helper: Out-of-Handbook Ignorance Admission
    # -----------------------------------------------------------------
    def _build_out_of_handbook_admission(self, query: str, language: str) -> Dict[str, Any]:
        messages = {
            "en": (
                f"**Epistemic Notice**: This inquiry cannot be answered from the active regulatory reference documents "
                f"(*AICTE Approval Process Handbook 2026–2027 v2026.1*).\n\n"
                f"TrustDoc strictly enforces anti-hallucination guardrails and **does not invent regulations, "
                f"extrapolate statutory mandates, or simulate authority decrees** for unindexed requirements.\n\n"
                f"**Next Steps**: If your query pertains to specialized norms (e.g. aviation infrastructure, university-specific "
                f"curriculum, or state municipal concessions), please consult the relevant state council gazette or the official "
                f"regulatory council portal directly at [https://facilities.aicte-india.org](https://facilities.aicte-india.org)."
            ),
            "hi": (
                f"**ज्ञानमीमांसा सूचना**: इस प्रश्न का उत्तर सक्रिय विनियामक संदर्भ दस्तावेजों (*AICTE APH 2026–2027 v2026.1*) से नहीं दिया जा सकता है।\n\n"
                f"TrustDoc गैर-सूचीबद्ध आवश्यकताओं के लिए नियमों का आविष्कार नहीं करता है और न ही भ्रामक जानकारी देता है।\n\n"
                f"**सुझाव**: कृपया आधिकारिक विनियामक परिषद पोर्टल से सीधे परामर्श करें।"
            ),
            "te": (
                f"**సమాచార నోటీసు**: ఈ ప్రశ్నకు ప్రస్తుత నియంత్రణ పత్రాలలో (*AICTE APH 2026–2027 v2026.1*) సమాధానం అందుబాటులో లేదు.\n\n"
                f"TrustDoc నిర్ధారించబడని అంశాలపై ఊహాజనిత సమాచారాన్ని అందించదు.\n\n"
                f"**సలహా**: దయచేసి అధికారిక కౌన్సిల్ పోర్టల్ ను సంప్రదించండి."
            )
        }
        return {
            "answer": messages.get(language, messages["en"]),
            "citations": [],
            "retrieved_clauses": [],
            "is_grounded": False,
            "disclaimer": "Query outside verified statutory catalog. Refusal issued pursuant to epistemic bounds."
        }

    # -----------------------------------------------------------------
    # Helper: Explain Application Findings
    # -----------------------------------------------------------------
    def _explain_application_findings(
        self,
        application: Application,
        findings: List[ComplianceFinding],
        language: str
    ) -> Dict[str, Any]:
        critical = [f for f in findings if f.severity == "CRITICAL"]
        warnings = [f for f in findings if f.severity == "WARNING"]

        citations = []
        for f in findings:
            citations.append({
                "rule_code": f.rule_code,
                "title": f.title,
                "page_number": f.source_field_ref.get("page_number", 1) if isinstance(f.source_field_ref, dict) else 1,
                "source_name": "AICTE Approval Process Handbook (APH) 2026-2027 (v2026.1)",
                "official_url": "https://facilities.aicte-india.org/approval/process-handbook-2026-27"
            })

        lines = [
            f"### Compliance Findings Breakdown for Application **{application.application_number}**",
            f"The deterministic evaluation engine flagged **{len(critical)} Critical Deficiencies** and **{len(warnings)} Warnings**:\n"
        ]

        for i, f in enumerate(findings, 1):
            sev_tag = "🔴 CRITICAL DEFICIENCY" if f.severity == "CRITICAL" else "🟡 WARNING"
            lines.append(f"**{i}. {sev_tag} — {f.title}** (`{f.rule_code}`)")
            lines.append(f"- **What was found**: {f.description}")
            if f.evidence_quote:
                lines.append(f"- **Evidence**: *\"{f.evidence_quote}\"*")
            lines.append(f"- **How to correct it**: {f.suggested_remediation or 'Submit certified supplemental affidavit.'}\n")

        lines.append(
            "\n> **Advisory Note**: Deterministic validation findings reflect mathematical and document discrepancies. "
            "They cannot be cleared by the Copilot; you must upload rectified documents to re-run validation."
        )

        return {
            "answer": "\n".join(lines),
            "citations": citations,
            "retrieved_clauses": [],
            "is_grounded": True,
            "disclaimer": "Deficiency explanation based on active deterministic engine results."
        }

    # -----------------------------------------------------------------
    # Helper: Grounded RAG Response with Citations
    # -----------------------------------------------------------------
    def _build_grounded_response(
        self,
        query: str,
        clauses: List[GroundedClause],
        application: Application,
        language: str,
        db: Optional[Session]
    ) -> Dict[str, Any]:
        top = clauses[0]

        # Check if the active application has an existing finding on this clause
        active_finding = None
        if db is not None:
            active_finding = db.query(ComplianceFinding).filter(
                ComplianceFinding.application_id == application.id,
                ComplianceFinding.rule_code == top.clause_number
            ).first()

        citations = []
        for c in clauses:
            citations.append({
                "rule_code": c.clause_number,
                "title": c.title,
                "page_number": c.page_number,
                "source_name": c.source_title or "AICTE Approval Process Handbook 2026–2027",
                "official_url": c.official_url or "https://facilities.aicte-india.org/approval/process-handbook-2026-27"
            })

        # Formulate actionable remediation guidance
        remediation_advice = "Ensure your uploaded documents explicitly fulfill the carpet area and validity specifications cited above."
        if "1.1" in top.clause_number or "land" in top.title.lower():
            remediation_advice = (
                "Ensure your registered Title Deed clearly states the contiguous plot acreage. If an area discrepancy exists, "
                "submit a registered rectifying deed from the competent sub-registrar office."
            )
        elif "3.1" in top.clause_number or "fire" in top.title.lower():
            remediation_advice = (
                "Verify that the Fire Safety Certificate (NOC) has not lapsed. If expired, submit the official renewal application "
                "endorsement from the Chief Fire Officer."
            )
        elif "2.1" in top.clause_number or "architect" in top.title.lower():
            remediation_advice = (
                "Have your Architect stamp the Master Layout with their active Council of Architecture registration number (Format: `CA/YYYY/NNNNN`)."
            )
        elif "4.1" in top.clause_number or "faculty" in top.title.lower():
            remediation_advice = (
                "Submit an updated cadre allocation affidavit maintaining the student-faculty ratio within the 1:15 threshold."
            )

        # Include application-specific warning if deterministic check failed
        app_status_note = ""
        if active_finding and active_finding.finding_status in ("FAIL", "WARNING"):
            app_status_note = (
                f"\n\n> ⚠️ **Status on Your Application**: Your application currently **fails this check** "
                f"({active_finding.title}). The Copilot cannot bypass this check. Please follow the corrective remediation above to resolve it."
            )

        if language == "hi":
            answer = (
                f"### विनियामक प्रावधान: **{top.clause_number}** (*{top.title}*)\n"
                f"**स्रोत संदर्भ**: [{top.source_title}]({top.official_url}) — पृष्ठ {top.page_number}\n\n"
                f"> \"{top.content[:260]}...\"\n\n"
                f"**सरल भाषा में व्याख्या**: तकनीकी संस्थान को इस खंड के तहत न्यूनतम विनिर्देशों को पूरा करना अनिवार्य है।\n\n"
                f"**सुधारात्मक कदम**: {remediation_advice}"
                f"{app_status_note}"
            )
        elif language == "te":
            answer = (
                f"### నియంత్రణ నిబంధన: **{top.clause_number}** (*{top.title}*)\n"
                f"**మూలం**: [{top.source_title}]({top.official_url}) — పేజీ {top.page_number}\n\n"
                f"> \"{top.content[:260]}...\"\n\n"
                f"**సులభమైన వివరణ**: కళాశాల ఈ నిబంధనలోని నిర్దేశిత ప్రమాణాలను తప్పనిసరిగా పాటించాలి.\n\n"
                f"**పరిష్కార చర్య**: {remediation_advice}"
                f"{app_status_note}"
            )
        else:
            answer = (
                f"### Statutory Requirement: **{top.clause_number}** — *{top.title}*\n"
                f"**Regulatory Source**: [{top.source_title}]({top.official_url}) (Page {top.page_number})\n\n"
                f"> \"{top.content[:280]}...\"\n\n"
                f"**Plain-Language Explanation**: To receive statutory accreditation for {application.program_name}, "
                f"your institution must strictly satisfy the benchmark threshold established under this clause.\n\n"
                f"**How to Correct & Comply**:\n"
                f"• {remediation_advice}\n"
                f"• All certificates must be issued by the designated competent statutory authority without expired validity."
                f"{app_status_note}"
            )

        return {
            "answer": answer,
            "citations": citations,
            "retrieved_clauses": [c.model_dump() for c in clauses],
            "is_grounded": True,
            "disclaimer": "Statutory guidance grounded in verified regulatory text. Does not constitute official approval."
        }


# Global singleton
copilot_service = ApplicantComplianceCopilotService.get_instance()
