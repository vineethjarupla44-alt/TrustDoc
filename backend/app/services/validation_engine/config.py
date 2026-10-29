from typing import Dict, List, Any
from pydantic import BaseModel, Field

DEFAULT_RULESET_VERSION = "v2026.1"

class ValidationEngineConfig(BaseModel):
    version_tag: str = Field(default=DEFAULT_RULESET_VERSION)
    
    # OCR Uncertainty Guardrail threshold
    min_ocr_confidence_threshold: float = 0.70

    # Cross-document numeric tolerance
    land_area_tolerance_acres: float = 0.05

    # Expiry notice window in days
    expiry_warning_days: int = 60

    # String similarity thresholds for institution name reconciliation
    name_similarity_pass_threshold: float = 0.85
    name_similarity_fail_threshold: float = 0.65

    # Mandatory documents per program / discipline
    mandatory_documents: Dict[str, List[str]] = Field(default_factory=lambda: {
        "DEFAULT": ["LAND_DEED", "BUILDING_PLAN", "FIRE_NOC", "FACULTY_LIST"],
        "Engineering & Technology": ["LAND_DEED", "BUILDING_PLAN", "FIRE_NOC", "FACULTY_LIST"],
        "Management": ["LAND_DEED", "BUILDING_PLAN", "FIRE_NOC", "FACULTY_LIST"],
        "Pharmacy": ["LAND_DEED", "BUILDING_PLAN", "FIRE_NOC", "FACULTY_LIST", "AFFILIATION_LETTERS"],
    })

    # Mandatory field keys per document type
    mandatory_fields: Dict[str, List[str]] = Field(default_factory=lambda: {
        "LAND_DEED": ["land_area_acres", "deed_number", "registration_date"],
        "BUILDING_PLAN": ["total_plot_area_acres", "coa_registration_no", "architect_name"],
        "FIRE_NOC": ["certificate_number", "valid_until_date"],
        "FACULTY_LIST": ["principal_name", "total_faculty", "student_count"],
        "AFFILIATION_LETTERS": ["affiliating_university", "valid_until_year"]
    })

    # Regex patterns for field-format validation
    format_regexes: Dict[str, str] = Field(default_factory=lambda: {
        "coa_registration_no": r"^(?:CA/)?\d{4}/\d{4,6}$",
        "deed_number": r"^[A-Za-z0-9\/\-\_]{4,40}$",
        "certificate_number": r"^[A-Za-z0-9\/\-\_]{3,40}$",
    })

    # Category statutory norms (AICTE Approval Process Handbook standards)
    category_norms: Dict[str, Dict[str, Any]] = Field(default_factory=lambda: {
        "Engineering & Technology": {
            "min_land_acres_urban": 2.50,
            "min_land_acres_rural": 5.00,
            "max_sfr_ratio": 15.0,
            "min_principal_required": True,
            "min_full_professors": 1
        },
        "Management": {
            "min_land_acres_urban": 1.00,
            "min_land_acres_rural": 2.00,
            "max_sfr_ratio": 20.0,
            "min_principal_required": True,
            "min_full_professors": 1
        },
        "Pharmacy": {
            "min_land_acres_urban": 2.00,
            "min_land_acres_rural": 4.00,
            "max_sfr_ratio": 15.0,
            "min_principal_required": True,
            "min_full_professors": 1
        },
        "DEFAULT": {
            "min_land_acres_urban": 2.00,
            "min_land_acres_rural": 4.00,
            "max_sfr_ratio": 20.0,
            "min_principal_required": True,
            "min_full_professors": 1
        }
    })

# Default singleton instance
default_config = ValidationEngineConfig()
