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

async def _generate_with_ollama(
    prompt: str,
    workflow_name: Optional[str] = None,
    vendor_category: Optional[str] = "General",
    description: Optional[str] = None
) -> Optional[WorkflowSchemaDefinition]:
    """
    Generate workflow schema using local Ollama model (e.g. gemma4:e4b).
    """
    import httpx
    schema_json = WorkflowSchemaDefinition.model_json_schema()

    system_instruction = f"""{SYSTEM_PROMPT}

You MUST output a valid JSON object matching the following JSON Schema:
{json.dumps(schema_json)}

Respond with pure JSON only. Do not include markdown codeblocks or commentary.
"""

    user_content = (
        f"Requirements Prompt:\n{prompt}\n\n"
        f"Provided Metadata:\n"
        f"- Workflow Name: {workflow_name or 'Auto-generate'}\n"
        f"- Vendor Category: {vendor_category or 'General'}\n"
        f"- Description: {description or 'None provided'}"
    )

    payload = {
        "model": settings.OLLAMA_MODEL,
        "messages": [
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": user_content}
        ],
        "format": "json",
        "stream": False,
        "options": {
            "temperature": 0.1
        }
    }

    url = f"{settings.OLLAMA_BASE_URL.rstrip('/')}/api/chat"
    timeout_config = httpx.Timeout(settings.OLLAMA_TIMEOUT_SECONDS, connect=30.0)
    async with httpx.AsyncClient(timeout=timeout_config) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()
        res_data = response.json()
        content = res_data.get("message", {}).get("content", "").strip()

        # Clean markdown code blocks if the model wraps output in fences
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()

        parsed_data = json.loads(content)
        if isinstance(parsed_data, dict):
            if not parsed_data.get("name") and workflow_name:
                parsed_data["name"] = workflow_name
            if not parsed_data.get("vendor_category"):
                parsed_data["vendor_category"] = vendor_category or "General"
            if not parsed_data.get("reminder_rules"):
                parsed_data["reminder_rules"] = [30, 7, 1]
            if not parsed_data.get("generated_questions"):
                parsed_data["generated_questions"] = []
            if not parsed_data.get("assumptions"):
                parsed_data["assumptions"] = []
            if not parsed_data.get("warnings"):
                parsed_data["warnings"] = []
            if "fields" in parsed_data and isinstance(parsed_data["fields"], list):
                for idx, f in enumerate(parsed_data["fields"]):
                    if isinstance(f, dict):
                        if not f.get("id"):
                            f["id"] = f"field_{idx}_{abs(hash(f.get('label', 'doc')))}"
                        if f.get("track_expiry") is None:
                            f["track_expiry"] = False
                        if f.get("required") is None:
                            f["required"] = True

        parsed = WorkflowSchemaDefinition.model_validate(parsed_data)
        if workflow_name and not parsed.name:
            parsed.name = workflow_name
        return parsed

def _generate_with_gemini(
    model_name: str,
    prompt: str,
    workflow_name: Optional[str] = None,
    vendor_category: Optional[str] = "General",
    description: Optional[str] = None
) -> Optional[WorkflowSchemaDefinition]:
    """
    Attempt structured workflow generation using Google Gemini model.
    """
    import os
    gemini_key = settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not gemini_key:
        return None

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

    logger.info(f"Calling Google Gemini API model: {model_name}")
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
        text = response.text.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()
        data = json.loads(text)
        parsed = WorkflowSchemaDefinition.model_validate(data)
        if workflow_name and not parsed.name:
            parsed.name = workflow_name
        return parsed

    return None

async def generate_workflow_from_requirements(
    prompt: str,
    workflow_name: Optional[str] = None,
    vendor_category: Optional[str] = "General",
    description: Optional[str] = None
) -> WorkflowSchemaDefinition:
    """
    Generation Priority Hierarchy:
    1. First: Gemini 3.5 (gemini-3.5-flash)
    2. If failed: Gemini 3.5 Flash-Lite (gemini-3.5-flash-lite)
    3. If failed: Local Ollama (gemma4:e4b)
    4. If failed: Deterministic fallback generator
    """
    import os
    gemini_key = settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")

    # --- 1. FIRST: GOOGLE GEMINI 3.5 ---
    if gemini_key:
        primary_model = getattr(settings, "GEMINI_PRIMARY_MODEL", "gemini-3.5-flash")
        try:
            logger.info(f"Tier 1: Checking form generation via Gemini 3.5 ({primary_model})...")
            result = _generate_with_gemini(
                model_name=primary_model,
                prompt=prompt,
                workflow_name=workflow_name,
                vendor_category=vendor_category,
                description=description
            )
            if result:
                logger.info(f"Successfully generated workflow using Gemini 3.5 ({primary_model})")
                return result
        except Exception as e:
            logger.warning(f"Tier 1 (Gemini 3.5: {primary_model}) failed: {type(e).__name__} - {e}. Falling back to Gemini 3.5 Flash-Lite.")

        # --- 2. SECOND: GEMINI 3.5 FLASH-LITE ---
        secondary_model = getattr(settings, "GEMINI_SECONDARY_MODEL", "gemini-3.5-flash-lite")
        try:
            logger.info(f"Tier 2: Checking form generation via Gemini 3.5 Flash-Lite ({secondary_model})...")
            result = _generate_with_gemini(
                model_name=secondary_model,
                prompt=prompt,
                workflow_name=workflow_name,
                vendor_category=vendor_category,
                description=description
            )
            if result:
                logger.info(f"Successfully generated workflow using Gemini 3.5 Flash-Lite ({secondary_model})")
                return result
        except Exception as e:
            logger.warning(f"Tier 2 (Gemini 3.5 Flash-Lite: {secondary_model}) failed: {type(e).__name__} - {e}. Falling back to Ollama.")

    # --- 3. THIRD: OLLAMA LOCAL MODEL ---
    if settings.OLLAMA_ENABLED:
        try:
            logger.info(f"Tier 3: Checking form generation via local Ollama ({settings.OLLAMA_MODEL})...")
            ollama_result = await _generate_with_ollama(
                prompt=prompt,
                workflow_name=workflow_name,
                vendor_category=vendor_category,
                description=description
            )
            if ollama_result:
                logger.info(f"Successfully generated workflow using local Ollama model {settings.OLLAMA_MODEL}")
                return ollama_result
        except Exception as e:
            logger.warning(f"Tier 3 (Local Ollama: {settings.OLLAMA_MODEL}) failed: {type(e).__name__} - {e}. Falling back to final safeguard.")

    # --- 4. FOURTH: OPENAI (If configured) ---
    if settings.OPENAI_API_KEY:
        try:
            logger.info(f"Checking form generation via OpenAI API (model: {settings.OPENAI_MODEL})...")
            from openai import OpenAI
            client = OpenAI(api_key=settings.OPENAI_API_KEY)
            user_content = (
                f"Requirements Prompt:\n{prompt}\n\n"
                f"Provided Metadata:\n"
                f"- Workflow Name: {workflow_name or 'Auto-generate'}\n"
                f"- Vendor Category: {vendor_category or 'General'}\n"
                f"- Description: {description or 'None provided'}"
            )
            response = client.beta.chat.completions.parse(
                model=settings.OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_content}
                ],
                response_format=WorkflowSchemaDefinition,
                temperature=0.2
            )
            parsed = response.choices[0].message.parsed
            if parsed:
                if workflow_name and not parsed.name:
                    parsed.name = workflow_name
                return parsed
        except Exception as e:
            logger.warning(f"OpenAI fallback failed: {e}")

    # --- 5. FINAL SAFEGUARD: DETERMINISTIC GENERATOR ---
    logger.info("All LLM services failed or unavailable. Using intelligent deterministic fallback generator.")
    return generate_deterministic_fallback(prompt, workflow_name, vendor_category, description)
