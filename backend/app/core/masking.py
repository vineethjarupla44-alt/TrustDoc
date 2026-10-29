import re
from typing import Any

# Regex patterns for Indian Identifiers and PII
AADHAAR_REGEX = re.compile(r'\b(\d{4})[ -]?(\d{4})[ -]?(\d{4})\b')
PAN_REGEX = re.compile(r'\b([A-Z]{5})(\d{4})([A-Z]{1})\b')
PHONE_REGEX = re.compile(r'\b(?:\+91|0)?([6-9]\d{5})(\d{4})\b')
EMAIL_REGEX = re.compile(r'\b([a-zA-Z0-9_.+-])[a-zA-Z0-9_.+-]+@([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)\b')

BANK_ACCOUNT_REGEX = re.compile(r'\b\d{9,18}\b')

def mask_text(text: str) -> str:
    """Masks sensitive PII patterns in plain text."""
    if not text:
        return text

    # Mask Aadhaar: e.g., 1234 5678 9012 -> XXXX-XXXX-9012
    text = AADHAAR_REGEX.sub(r'XXXX-XXXX-\3', text)

    # Mask PAN: e.g., ABCDE1234F -> XXXXX\2\3
    text = PAN_REGEX.sub(r'XXXXX\2\3', text)

    # Mask Phone: e.g., 9876543210 -> XXXXXX3210
    text = PHONE_REGEX.sub(r'XXXXXX\2', text)

    # Mask Email: e.g., contact@apexedu.in -> c***@apexedu.in
    text = EMAIL_REGEX.sub(r'\1***@\2', text)

    return text

def mask_dict_fields(data: Any, unmask: bool = False) -> Any:
    """
    Recursively traverse dictionary or list, applying PII masking to string values
    unless unmask is explicitly requested (subject to audit logging).
    """
    if unmask:
        return data

    if isinstance(data, dict):
        masked_dict = {}
        for k, v in data.items():
            # If key explicitly indicates sensitive personal data
            if k.lower() in ("aadhaar", "aadhaar_number", "pan", "pan_number", "ssn", "bank_account"):
                if isinstance(v, str):
                    masked_dict[k] = mask_text(v)
                else:
                    masked_dict[k] = "XXXXXXXX"
            else:
                masked_dict[k] = mask_dict_fields(v, unmask=False)
        return masked_dict
    elif isinstance(data, list):
        return [mask_dict_fields(item, unmask=False) for item in data]
    elif isinstance(data, str):
        return mask_text(data)
    else:
        return data

class SensitiveContentLogFilter:
    """
    Zero-knowledge privacy log filter.
    Intercepts log records to scrub sensitive PII and prevent large raw document
    OCR dumps from reaching stdout or log files.
    """
    def filter(self, record) -> bool:
        if hasattr(record, "msg") and isinstance(record.msg, str):
            record.msg = mask_text(record.msg)
            if len(record.msg) > 1000:
                record.msg = record.msg[:1000] + "... [TRUNCATED FOR PRIVACY]"
        if hasattr(record, "args") and record.args:
            if isinstance(record.args, dict):
                record.args = mask_dict_fields(record.args)
            elif isinstance(record.args, tuple):
                record.args = tuple(mask_text(str(a)) if isinstance(a, str) else a for a in record.args)
        return True
