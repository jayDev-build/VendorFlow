import re
import json
import logging
from typing import Optional, List
from app.core.config import settings
from app.schemas.workflow import (
    WorkflowSchemaDefinition,
    WorkflowFieldDefinition,
    FieldValidationRules,
)

logger = logging.getLogger("vendorflow.ai_generator")

SYSTEM_PROMPT = """You are an expert Enterprise Compliance & Vendor Management Systems Architect.
Your task is to analyze plain-English vendor onboarding requirements and generate a structured, highly usable onboarding workflow definition according to the provided JSON schema.

Guidelines:
1. Identify all required vendor profile fields (Company Name, Registration Number, Contact Name, Email, Phone).
2. For each document mentioned (e.g., 'GST certificate', 'PAN card', 'bank proof', 'insurance certificate', 'W-9', 'ISO certification'), create a 'file_upload' field.
3. Group documents into meaningful categories: 'Tax Documents', 'Legal & Compliance', 'Banking & Financial', 'Insurance & Liability', 'Operational'.
4. Expiry Tracking:
   - Enable 'track_expiry=True' ONLY when explicitly requested (e.g., 'Insurance must have an expiry date') or standard perishable documents like Insurance, Trade Licenses, or Work Permits.
   - For static identity/tax documents (e.g. PAN card, Business Registration), set 'track_expiry=False' unless requested.
5. Parse approval rules (e.g. 'requires administrator approval' -> approval_required=True).
6. Parse reminder intervals (e.g. '30 days before expiry' -> reminder_rules=[30, 7, 1]).
7. Assumptions & Warnings:
   - List any assumptions you made (e.g., assumed file types PDF/PNG/JPEG up to 10MB).
   - List compliance warnings (e.g., reminders require valid expiry dates input by vendor during submission).
   - Never assume an uploaded file is legally valid or automatically verified.
8. Output MUST strictly conform to the WorkflowSchemaDefinition schema.
"""

def generate_deterministic_fallback(
    prompt: str,
    workflow_name: Optional[str] = None,
    vendor_category: Optional[str] = "General",
    description: Optional[str] = None
) -> WorkflowSchemaDefinition:
    """
    Intelligent fallback parser that analyzes keywords in the prompt to create a rich,
    usable workflow even when no OpenAI API key is supplied.
    """
    p_lower = prompt.lower()

    # Determine workflow title
    name = workflow_name or "Vendor Onboarding & Compliance Workflow"
    if "it" in p_lower or "software" in p_lower:
        vendor_category = "IT & Software Services"
    elif "logistic" in p_lower or "transport" in p_lower:
        vendor_category = "Logistics & Transport"
    elif "facility" in p_lower or "construction" in p_lower:
        vendor_category = "Facilities & Contractors"
    elif not vendor_category or vendor_category == "General":
        vendor_category = "General Vendor"

    fields: List[WorkflowFieldDefinition] = [
        WorkflowFieldDefinition(
            id="field_company_name",
            label="Legal Company Name",
            field_type="short_text",
            required=True,
            help_text="Registered legal entity name as shown on tax documents.",
            document_category=None,
            track_expiry=False,
            validation=FieldValidationRules(min_length=2, max_length=150)
        ),
        WorkflowFieldDefinition(
            id="field_business_type",
            label="Business Structure",
            field_type="dropdown",
            required=True,
            help_text="Select your registered corporate structure.",
            document_category=None,
            track_expiry=False,
            validation=FieldValidationRules(
                options=["Private Limited / Corporation", "LLC / LLP", "Partnership", "Sole Proprietorship"]
            )
        ),
        WorkflowFieldDefinition(
            id="field_contact_person",
            label="Primary Contact Person",
            field_type="short_text",
            required=True,
            help_text="Full name of authorized company representative.",
            document_category=None,
            track_expiry=False
        ),
        WorkflowFieldDefinition(
            id="field_contact_phone",
            label="Contact Phone Number",
            field_type="phone",
            required=True,
            help_text="Direct phone number with country code.",
            document_category=None,
            track_expiry=False
        )
    ]

    # Keyword detections for document uploads
    has_gst = "gst" in p_lower or "tax id" in p_lower or "vat" in p_lower
    has_pan = "pan" in p_lower or "ein" in p_lower or "tin" in p_lower
    has_reg = "registration" in p_lower or "incorporation" in p_lower or "license" in p_lower
    has_bank = "bank" in p_lower or "financial" in p_lower or "voided check" in p_lower
    has_insurance = "insurance" in p_lower or "liability" in p_lower or "policy" in p_lower
    has_nda = "nda" in p_lower or "non-disclosure" in p_lower or "agreement" in p_lower

    if has_gst:
        fields.append(
            WorkflowFieldDefinition(
                id="field_doc_gst",
                label="GST / VAT Registration Certificate",
                field_type="file_upload",
                required=True,
                help_text="Upload official government tax registration certificate (PDF, PNG, or JPEG).",
                document_category="Tax Documents",
                track_expiry=False,
                allowed_file_types=["application/pdf", "image/png", "image/jpeg"],
                max_file_size_mb=10
            )
        )

    if has_pan:
        fields.append(
            WorkflowFieldDefinition(
                id="field_doc_pan",
                label="PAN / Corporate Tax ID Card",
                field_type="file_upload",
                required=True,
                help_text="Clear copy of company permanent account number / corporate tax identification.",
                document_category="Tax Documents",
                track_expiry=False,
                allowed_file_types=["application/pdf", "image/png", "image/jpeg"],
                max_file_size_mb=10
            )
        )

    if has_reg or (not has_gst and not has_pan):
        fields.append(
            WorkflowFieldDefinition(
                id="field_doc_business_reg",
                label="Business Registration / Certificate of Incorporation",
                field_type="file_upload",
                required=True,
                help_text="Official state/national incorporation certificate or commercial trade license.",
                document_category="Legal & Compliance",
                track_expiry="trade license" in p_lower or "expiry" in p_lower,
                allowed_file_types=["application/pdf", "image/png", "image/jpeg"],
                max_file_size_mb=10
            )
        )

    if has_bank or len(fields) <= 5:
        fields.append(
            WorkflowFieldDefinition(
                id="field_doc_bank_proof",
                label="Bank Account Proof / Cancelled Cheque",
                field_type="file_upload",
                required=True,
                help_text="Cancelled cheque or official bank statement header verifying routing & account details.",
                document_category="Banking & Financial",
                track_expiry=False,
                allowed_file_types=["application/pdf", "image/png", "image/jpeg"],
                max_file_size_mb=10
            )
        )

    if has_insurance or "insurance" in p_lower:
        fields.append(
            WorkflowFieldDefinition(
                id="field_doc_insurance",
                label="Commercial General Liability Insurance Certificate",
                field_type="file_upload",
                required=True,
                help_text="Current insurance certificate showing policy coverage, insurer, and expiration date.",
                document_category="Insurance & Liability",
                track_expiry=True, # Explicit expiry tracking
                allowed_file_types=["application/pdf", "image/png", "image/jpeg"],
                max_file_size_mb=10
            )
        )

    if has_nda:
        fields.append(
            WorkflowFieldDefinition(
                id="field_doc_nda",
                label="Executed Non-Disclosure Agreement (NDA)",
                field_type="file_upload",
                required=True,
                help_text="Duly signed copy of the mutual confidentiality agreement.",
                document_category="Legal & Compliance",
                track_expiry=False,
                allowed_file_types=["application/pdf"],
                max_file_size_mb=10
            )
        )

    # Reminder intervals
    reminder_rules = [30, 7, 1]
    days_matches = re.findall(r"(\d+)\s*days?", p_lower)
    if days_matches:
        parsed_days = sorted(list(set(int(d) for d in days_matches)), reverse=True)
        if parsed_days:
            reminder_rules = parsed_days

    # Approval check
    approval_required = True
    if "no approval" in p_lower or "auto-approve" in p_lower:
        approval_required = False

    assumptions = [
        "Inferred file size ceiling of 10MB per document with PDF, PNG, and JPEG allowed.",
        "Set mandatory administrator approval before vendors achieve APPROVED status.",
        "Configured automated reminder cadence for expiring certificates.",
        "Demonstration parser activated because OpenAI API Key is not configured."
    ]

    warnings = [
        "Vendor-uploaded documents require explicit administrator verification before acceptance.",
        "Documents with expiry tracking will require an expiration date upon vendor submission.",
        "Ensure reminder intervals conform to your organization's SLA timeline."
    ]

    return WorkflowSchemaDefinition(
        name=name,
        vendor_category=vendor_category,
        description=description or f"Generated automated onboarding workflow tailored for {vendor_category} compliance.",
        fields=fields,
        approval_required=approval_required,
        reminder_rules=reminder_rules,
        generated_questions=[
            "Do any additional industry-specific compliance certificates (e.g. ISO 27001 or SOC 2) apply?",
            "Should vendor submissions notify a specific compliance officer in addition to organization admins?"
        ],
        assumptions=assumptions,
        warnings=warnings
    )

async def generate_workflow_from_requirements(
    prompt: str,
    workflow_name: Optional[str] = None,
    vendor_category: Optional[str] = "General",
    description: Optional[str] = None
) -> WorkflowSchemaDefinition:
    """
    Main entrypoint:
    1. If GEMINI_API_KEY (or GOOGLE_API_KEY) is present, uses Google Gemini with structured schema output.
    2. If OPENAI_API_KEY is present, uses OpenAI with structured schema output.
    3. If no API key is provided, cleanly falls back to the deterministic generator.
    """
    import os
    gemini_key = settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")

    # --- 1. GOOGLE GEMINI INTEGRATION ---
    if gemini_key:
        logger.info(f"Using Google Gemini API (model: {settings.GEMINI_MODEL}) for structured workflow generation.")
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=gemini_key)
            user_content = (
                f"Requirements Prompt:\n{prompt}\n\n"
                f"Provided Metadata:\n"
                f"- Workflow Name: {workflow_name or 'Auto-generate'}\n"
                f"- Vendor Category: {vendor_category or 'General'}\n"
                f"- Description: {description or 'None provided'}"
            )

            # Determine models to try (primary + fallback)
            models_to_try = [settings.GEMINI_MODEL]
            if settings.GEMINI_MODEL not in ["gemini-3.5-flash", "gemini-flash-latest"]:
                models_to_try.extend(["gemini-3.5-flash", "gemini-flash-latest"])

            for model_name in models_to_try:
                try:
                    logger.info(f"Generating workflow using Gemini model: {model_name}")
                    response = client.models.generate_content(
                        model=model_name,
                        contents=user_content,
                        config=types.GenerateContentConfig(
                            response_mime_type="application/json",
                            response_schema=WorkflowSchemaDefinition,
                            temperature=0.2,
                            system_instruction=SYSTEM_PROMPT
                        )
                    )

                    if hasattr(response, 'parsed') and response.parsed:
                        parsed = response.parsed
                        if isinstance(parsed, WorkflowSchemaDefinition):
                            if workflow_name and not parsed.name:
                                parsed.name = workflow_name
                            return parsed
                        elif isinstance(parsed, dict):
                            return WorkflowSchemaDefinition.model_validate(parsed)

                    if response.text:
                        data = json.loads(response.text)
                        parsed = WorkflowSchemaDefinition.model_validate(data)
                        if workflow_name and not parsed.name:
                            parsed.name = workflow_name
                        return parsed
                except Exception as e:
                    logger.warning(f"Gemini model {model_name} failed: {e}")
                    continue

        except Exception as exc:
            logger.error(f"Error calling Google Gemini API: {exc}. Falling back to deterministic generator.")
            fallback = generate_deterministic_fallback(prompt, workflow_name, vendor_category, description)
            fallback.warnings.append(f"Gemini API returned an error: {str(exc)}. Fallback template used.")
            return fallback

    # --- 2. OPENAI INTEGRATION ---
    elif settings.OPENAI_API_KEY:
        logger.info(f"Using OpenAI API (model: {settings.OPENAI_MODEL}) for structured workflow generation.")
        try:
            from openai import OpenAI
            client = OpenAI(api_key=settings.OPENAI_API_KEY)

            user_content = (
                f"Requirements Prompt:\n{prompt}\n\n"
                f"Provided Metadata:\n"
                f"- Workflow Name: {workflow_name or 'Auto-generate'}\n"
                f"- Vendor Category: {vendor_category or 'General'}\n"
                f"- Description: {description or 'None provided'}"
            )

            for attempt in range(2):
                try:
                    response = client.beta.chat.completions.parse(
                        model=settings.OPENAI_MODEL,
                        messages=[
                            {"role": "system", "content": SYSTEM_PROMPT},
                            {"role": "user", "content": user_content}
                        ],
                        response_format=WorkflowSchemaDefinition,
                        temperature=0.2
                    )
                    parsed: WorkflowSchemaDefinition = response.choices[0].message.parsed
                    if parsed:
                        if workflow_name and not parsed.name:
                            parsed.name = workflow_name
                        return parsed
                except Exception as e:
                    logger.warning(f"OpenAI attempt {attempt + 1} failed: {e}")
                    if attempt == 1:
                        raise e

        except Exception as exc:
            logger.error(f"Error calling OpenAI API: {exc}. Falling back to deterministic generator.")
            fallback = generate_deterministic_fallback(prompt, workflow_name, vendor_category, description)
            fallback.warnings.append(f"OpenAI API returned an error: {str(exc)}. Fallback template used.")
            return fallback

    # --- 3. DETERMINISTIC FALLBACK (No API Key Provided) ---
    logger.info("No Gemini or OpenAI API key configured. Using intelligent deterministic fallback generator.")
    return generate_deterministic_fallback(prompt, workflow_name, vendor_category, description)
