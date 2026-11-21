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

logger = logging.getLogger("formgate.ai_generator")

SYSTEM_PROMPT = """You are an expert UK & US Bookkeeping, Accounting & Tax Compliance Systems Architect.
Your task is to analyze plain-English bookkeeping, accounting, tax intake, or financial onboarding requirements for UK and US business clients, and generate a structured, highly usable, production-ready workflow definition according to the provided JSON schema.

CLIENT JURISDICTIONS & DOMAIN SCOPE:
You specialize strictly in UK and US business client onboarding, bookkeeping, financial compliance, and tax preparation:
- United States (US) Bookkeeping & Tax:
  * Entities: LLCs (Single & Multi-Member), S-Corporations, C-Corporations, Partnerships, Sole Proprietorships.
  * Standard Documents: IRS Form W-9 / W-8BEN, IRS EIN Confirmation Letter (CP 575 or 147C), State Articles of Organization / Incorporation, Bank Statements (checking/savings/merchant: last 3-12 months), Credit Card Statements (Amex, Chase, Visa/Mastercard), Prior Year Federal Tax Returns (Form 1040 Schedule C, 1120, 1120-S, 1065), State Sales Tax Exemption / Resale Certificates, Quarterly Payroll Reports (Form 941, Form 940, W-2 & 1099-NEC summaries), Year-End Financials (Balance Sheet, Profit & Loss, Trial Balance, General Ledger), Loan/Lease Agreements, Accounting Software Access (QuickBooks Online, Xero), Signed Engagement Letters.
- United Kingdom (UK) Bookkeeping & Statutory Accounts:
  * Entities: Private Limited Companies (Ltd), Limited Liability Partnerships (LLP), Sole Traders, Partnerships.
  * Standard Documents: Companies House Certificate of Incorporation, Memorandum & Articles of Association (MAA), HMRC Corporation Tax Unique Taxpayer Reference (UTR) Letter, HMRC VAT Registration Certificate (VAT 484), Business Bank Account Statements (last 3-12 months), Merchant Settlement Statements (Stripe, PayPal, SumUp, Shopify), Prior Year Statutory Accounts & HMRC Corporation Tax Return (CT600 & computations), UK PAYE/Payroll Reports (P60, P45, P11D, FPS/EPS submissions), Quarterly VAT Return Summaries (Making Tax Digital / MTD), Director/Shareholder KYC Photo ID (Passport or UK Photocard Driving Licence), Director Proof of Address (utility bill, council tax, bank statement < 3 months old), Prior Accountant Professional Clearance Handover, Signed Letter of Engagement.

FIELD CAPABILITIES & SUPPORTED FIELD TYPES:
You have 8 specialized field types at your disposal:
1. 'short_text': Single-line text input for legal names, business identifiers, registration numbers.
   - Examples: Legal Company Name, DBA / Trading Name, EIN / Federal Tax ID, Companies House Number, UTR Number, VAT Number, Primary Contact Name.
2. 'long_text': Multi-line textarea for addresses, accounting notes, chart of accounts descriptions, or scope.
   - Examples: Registered Business Address, Principal Place of Business, Business Activities Description, Outstanding Bookkeeping Backlog / Clean-up Notes.
3. 'email': Validated email address input.
   - Examples: Accounting Contact Email, Primary Billing Email, Authorized Signatory Email.
4. 'phone': Phone number input with international formatting support.
   - Examples: Business Phone Number, Direct Mobile Number.
5. 'date': Dedicated calendar date picker.
   - Examples: Business Formation Date, Target Onboarding Date, Fiscal Year-End Date, Prior Filing Deadline.
6. 'dropdown': Single-select dropdown menu.
   - MANDATORY: Whenever you output a 'dropdown' field, you MUST generate realistic selectable options in 'options' (at least 2-7 realistic choices).
   - Examples:
     * US Entity Structure: ["LLC (Single-Member)", "LLC (Multi-Member)", "S-Corporation", "C-Corporation", "Partnership", "Sole Proprietorship"]
     * UK Entity Structure: ["Private Limited Company (Ltd)", "Limited Liability Partnership (LLP)", "Sole Trader", "Public Limited Company (Plc)"]
     * Accounting Software: ["QuickBooks Online", "Xero", "FreshBooks", "Sage Business Cloud", "Wave", "Desktop Software / Excel", "None / New Setup"]
     * Fiscal Year End: ["December 31", "March 31 (UK Standard)", "June 30", "September 30", "Other"]
     * Bookkeeping Frequency: ["Monthly Bookkeeping", "Quarterly Bookkeeping", "Annual Year-End Clean-up", "Catch-up / Backlog Only"]
     * Payroll Provider: ["Gusto", "ADP", "QuickBooks Payroll", "Paychex", "UK BrightPay", "UK Moneysoft", "No Payroll"]
7. 'checkbox': Multi-select choice OR single-item consent/declaration acknowledgment.
   - MANDATORY: Populate 'options' with the declaration statement. NEVER leave empty.
   - Examples:
     * Engagement & Terms: ["We acknowledge the bookkeeping engagement terms, agree to provide complete banking access, and declare all submitted financial records are authentic."]
     * Bank Authorization: ["We authorize the accounting firm to view bank and merchant processing statements for reconciliation purposes."]
     * VAT / Sales Tax nexus acknowledgment: ["We certify our sales tax / VAT registration status and authorize digital submission on our behalf."]
8. 'file_upload': Document or statement attachment upload.
   - Group documents into logical 'document_category': 'Statutory & Tax', 'Banking & Statements', 'Financial Statements', 'Payroll & Compliance', 'KYC & Identification', 'Engagement & Legal'.
   - Specify appropriate 'allowed_file_types': ["application/pdf", "image/png", "image/jpeg", "text/csv", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"].
   - Set 'max_file_size_mb': typically 15 to 25.

EXPIRY TRACKING RULES:
- Set 'track_expiry=True' ONLY for renewable/expiring documents: Passports, Driving Licences, State Sales Tax Exemption Certificates, Annual Insurance, or Engagement Letters requiring yearly renewal.
- Set 'track_expiry=False' for permanent historical records: W-9, EIN Confirmation Letters, Certificates of Incorporation, HMRC UTR notices, prior tax returns (1120/CT600), historical bank statements, voided checks.

OUTPUT SPECIFICATION:
Respond strictly with a JSON object conforming to the WorkflowSchemaDefinition schema. Never include markdown explanations outside the JSON object.
"""

def generate_deterministic_fallback(
    prompt: str,
    workflow_name: Optional[str] = None,
    vendor_category: Optional[str] = "General",
    description: Optional[str] = None
) -> WorkflowSchemaDefinition:
    """
    Intelligent UK & US Bookkeeping fallback generator that analyzes prompt keywords
    to create a rich, realistic, usable client financial intake workflow.
    """
    p_lower = prompt.lower()
    import re
    words = set(re.findall(r"\b[a-zA-Z0-9_-]+\b", p_lower))

    # Detect jurisdiction and bookkeeping focus
    is_payroll = any(k in p_lower for k in ("payroll", "wages", "direct deposit")) or any(k in words for k in ("p60", "p45", "941", "940", "w2", "w-2", "paye"))
    is_vat_salestax = any(k in p_lower for k in ("sales tax", "resale", "making tax digital")) or any(k in words for k in ("vat", "mtd", "nexus"))
    is_uk = any(k in p_lower for k in ("united kingdom", "companies house", "corporation tax", "limited company", "statutory accounts")) or any(k in words for k in ("uk", "hmrc", "utr", "ct600", "ltd", "llp", "crn"))
    is_us = any(k in p_lower for k in ("united states", "quickbooks", "delaware", "wyoming", "articles of organization")) or any(k in words for k in ("us", "usa", "irs", "w9", "w-9", "ein", "llc", "s-corp", "c-corp", "1120", "1065"))

    fields: List[WorkflowFieldDefinition] = []

    if is_payroll:
        name = workflow_name or "US & UK Payroll Compliance & Year-End Reporting Packet"
        category = vendor_category if vendor_category and vendor_category != "General" else "Payroll & Wage Compliance"
        desc = description or "Client onboarding for payroll processing, wage tax compliance, Form 941/W-2 reporting (US) or PAYE/P60 RTI filings (UK)."
        fields = [
            WorkflowFieldDefinition(
                id="field_company_name",
                label="Employer Legal Name",
                field_type="short_text",
                required=True,
                help_text="Employer registered business name.",
                validation=FieldValidationRules(min_length=2, max_length=150)
            ),
            WorkflowFieldDefinition(
                id="field_payroll_jurisdiction",
                label="Payroll Jurisdiction",
                field_type="dropdown",
                required=True,
                options=["United States (IRS / Multi-State)", "United Kingdom (HMRC PAYE)", "Dual Jurisdiction (US & UK)"],
                validation=FieldValidationRules(
                    options=["United States (IRS / Multi-State)", "United Kingdom (HMRC PAYE)", "Dual Jurisdiction (US & UK)"]
                )
            ),
            WorkflowFieldDefinition(
                id="field_pay_frequency",
                label="Payroll Frequency",
                field_type="dropdown",
                required=True,
                options=["Bi-Weekly (Every 2 Weeks)", "Semi-Monthly (Twice Monthly)", "Monthly", "Weekly"],
                validation=FieldValidationRules(
                    options=["Bi-Weekly (Every 2 Weeks)", "Semi-Monthly (Twice Monthly)", "Monthly", "Weekly"]
                )
            ),
            WorkflowFieldDefinition(
                id="field_employee_count",
                label="Total Headcount (W-2 / PAYE & 1099 Contractors)",
                field_type="dropdown",
                required=True,
                options=["1-5 Employees", "6-15 Employees", "16-50 Employees", "50+ Employees"],
                validation=FieldValidationRules(
                    options=["1-5 Employees", "6-15 Employees", "16-50 Employees", "50+ Employees"]
                )
            ),
            WorkflowFieldDefinition(
                id="field_contact_email",
                label="Payroll Manager Email",
                field_type="email",
                required=True,
                help_text="Designated email for payroll approvals and tax withholdings."
            ),
            WorkflowFieldDefinition(
                id="field_contact_phone",
                label="Contact Phone Number",
                field_type="phone",
                required=True
            ),
            WorkflowFieldDefinition(
                id="field_payroll_authorization",
                label="Payroll Tax Authority & Representation Consent",
                field_type="checkbox",
                required=True,
                options=["We authorize the payroll team to submit statutory wage tax returns, prepare tax forms (941/W-2 or P60/FPS), and remit required employer payroll withholdings."],
                validation=FieldValidationRules(
                    options=["We authorize the payroll team to submit statutory wage tax returns, prepare tax forms (941/W-2 or P60/FPS), and remit required employer payroll withholdings."]
                )
            )
        ]

    elif is_vat_salestax:
        name = workflow_name or "VAT & Multi-State Sales Tax Compliance Intake"
        category = vendor_category if vendor_category and vendor_category != "General" else "VAT & Sales Tax Compliance"
        desc = description or "Client onboarding for UK VAT registration / MTD quarterly returns and US State Sales Tax nexus registrations & reporting."
        fields = [
            WorkflowFieldDefinition(
                id="field_entity_name",
                label="Taxable Business Entity Name",
                field_type="short_text",
                required=True,
                validation=FieldValidationRules(min_length=2, max_length=150)
            ),
            WorkflowFieldDefinition(
                id="field_tax_regime",
                label="Tax Regime Scope",
                field_type="dropdown",
                required=True,
                options=["UK HMRC VAT (Making Tax Digital)", "US Multi-State Sales Tax", "UK VAT & US Sales Tax Combined"],
                validation=FieldValidationRules(
                    options=["UK HMRC VAT (Making Tax Digital)", "US Multi-State Sales Tax", "UK VAT & US Sales Tax Combined"]
                )
            ),
            WorkflowFieldDefinition(
                id="field_sales_channels",
                label="Primary E-Commerce & Sales Channels",
                field_type="dropdown",
                required=True,
                options=["Shopify / Direct Website", "Amazon FBA", "Stripe / B2B SaaS Invoicing", "Multi-Channel (Shopify, Amazon, Retail)", "Wholesale / B2B Services"],
                validation=FieldValidationRules(
                    options=["Shopify / Direct Website", "Amazon FBA", "Stripe / B2B SaaS Invoicing", "Multi-Channel (Shopify, Amazon, Retail)", "Wholesale / B2B Services"]
                )
            ),
            WorkflowFieldDefinition(
                id="field_contact_email",
                label="Tax Compliance Contact Email",
                field_type="email",
                required=True
            ),
            WorkflowFieldDefinition(
                id="field_sales_tax_declaration",
                label="Indirect Tax Filing Authorization & Declaration",
                field_type="checkbox",
                required=True,
                options=["We certify our reported gross sales figures and authorize the preparation and electronic submission of statutory VAT/Sales Tax returns."],
                validation=FieldValidationRules(
                    options=["We certify our reported gross sales figures and authorize the preparation and electronic submission of statutory VAT/Sales Tax returns."]
                )
            )
        ]

    elif is_uk:
        name = workflow_name or "UK Limited Company Bookkeeping & Year-End Accounts Intake"
        category = vendor_category if vendor_category and vendor_category != "General" else "UK Accounting & Bookkeeping"
        desc = description or "Onboarding packet for UK Limited Companies & LLPs covering Companies House filings, HMRC Corporation Tax, VAT (MTD), and banking reconciliations."
        fields = [
            WorkflowFieldDefinition(
                id="field_company_name",
                label="Registered Company Name",
                field_type="short_text",
                required=True,
                help_text="Full registered legal name as recorded at Companies House.",
                validation=FieldValidationRules(min_length=2, max_length=150)
            ),
            WorkflowFieldDefinition(
                id="field_company_number",
                label="Companies House Registration Number (CRN)",
                field_type="short_text",
                required=True,
                help_text="8-digit UK Companies House registration number (e.g. 12345678 or SC123456)."
            ),
            WorkflowFieldDefinition(
                id="field_entity_structure",
                label="UK Business Structure",
                field_type="dropdown",
                required=True,
                help_text="Select your UK corporate legal structure.",
                options=["Private Limited Company (Ltd)", "Limited Liability Partnership (LLP)", "Sole Trader", "Public Limited Company (Plc)", "Community Interest Company (CIC)"],
                validation=FieldValidationRules(
                    options=["Private Limited Company (Ltd)", "Limited Liability Partnership (LLP)", "Sole Trader", "Public Limited Company (Plc)", "Community Interest Company (CIC)"]
                )
            ),
            WorkflowFieldDefinition(
                id="field_accounting_software",
                label="Primary Bookkeeping Software",
                field_type="dropdown",
                required=True,
                help_text="Select the cloud accounting platform your business uses.",
                options=["Xero", "QuickBooks Online (QBO)", "FreeAgent", "Sage Business Cloud", "Dext / Receipt Bank", "Spreadsheet / Excel", "None / New Setup"],
                validation=FieldValidationRules(
                    options=["Xero", "QuickBooks Online (QBO)", "FreeAgent", "Sage Business Cloud", "Dext / Receipt Bank", "Spreadsheet / Excel", "None / New Setup"]
                )
            ),
            WorkflowFieldDefinition(
                id="field_fiscal_year_end",
                label="Accounting Reference Date (Year-End)",
                field_type="dropdown",
                required=True,
                help_text="Company annual financial year-end date.",
                options=["March 31 (UK Standard)", "December 31", "April 5 (Tax Year)", "June 30", "September 30", "Other"],
                validation=FieldValidationRules(
                    options=["March 31 (UK Standard)", "December 31", "April 5 (Tax Year)", "June 30", "September 30", "Other"]
                )
            ),
            WorkflowFieldDefinition(
                id="field_contact_director",
                label="Managing Director / Primary Contact Name",
                field_type="short_text",
                required=True,
                help_text="Full legal name of company director or designated member."
            ),
            WorkflowFieldDefinition(
                id="field_contact_email",
                label="Accounting & Tax Communications Email",
                field_type="email",
                required=True,
                help_text="Designated email for statutory accounts approval, tax queries, and invoices."
            ),
            WorkflowFieldDefinition(
                id="field_contact_phone",
                label="Contact Telephone Number",
                field_type="phone",
                required=True,
                help_text="UK telephone or mobile number (+44)."
            ),
            WorkflowFieldDefinition(
                id="field_registered_office",
                label="Registered Office Address",
                field_type="long_text",
                required=True,
                help_text="Official UK registered office address including postcode."
            ),
            WorkflowFieldDefinition(
                id="field_bookkeeping_scope",
                label="Bookkeeping Scope & Catch-up Requirements",
                field_type="long_text",
                required=False,
                help_text="Specify monthly transaction volumes, outstanding months to reconcile, or specific VAT/payroll needs."
            ),
            WorkflowFieldDefinition(
                id="field_engagement_declaration",
                label="Letter of Engagement & AML Compliance Declaration",
                field_type="checkbox",
                required=True,
                help_text="Statutory anti-money laundering (AML) and client engagement confirmation.",
                options=["We confirm the appointment of the accounting practice for UK bookkeeping, VAT, and statutory accounts preparation, authorizing direct HMRC agent authorization and bank data feed connections."],
                validation=FieldValidationRules(
                    options=["We confirm the appointment of the accounting practice for UK bookkeeping, VAT, and statutory accounts preparation, authorizing direct HMRC agent authorization and bank data feed connections."]
                )
            )
        ]

    elif is_us:
        name = workflow_name or "US Client Monthly Bookkeeping & Tax Onboarding"
        category = vendor_category if vendor_category and vendor_category != "General" else "US Accounting & Bookkeeping"
        desc = description or "Client bookkeeping intake for US businesses covering IRS W-9/EIN verification, QuickBooks/Xero chart of accounts, bank/credit card reconciliations, and Federal/State tax filings."
        fields = [
            WorkflowFieldDefinition(
                id="field_business_name",
                label="Legal Business Entity Name",
                field_type="short_text",
                required=True,
                help_text="Full legal entity name as registered with the Secretary of State.",
                validation=FieldValidationRules(min_length=2, max_length=150)
            ),
            WorkflowFieldDefinition(
                id="field_dba_name",
                label="DBA / Trade Name (if applicable)",
                field_type="short_text",
                required=False,
                help_text="Doing Business As (DBA) or fictitious business name."
            ),
            WorkflowFieldDefinition(
                id="field_entity_structure",
                label="US Business Tax Classification",
                field_type="dropdown",
                required=True,
                help_text="Select your federal tax classification.",
                options=["LLC (Single-Member / Disregarded)", "LLC (Multi-Member / Partnership)", "S-Corporation (Form 1120-S)", "C-Corporation (Form 1120)", "Partnership (Form 1065)", "Sole Proprietorship (Schedule C)"],
                validation=FieldValidationRules(
                    options=["LLC (Single-Member / Disregarded)", "LLC (Multi-Member / Partnership)", "S-Corporation (Form 1120-S)", "C-Corporation (Form 1120)", "Partnership (Form 1065)", "Sole Proprietorship (Schedule C)"]
                )
            ),
            WorkflowFieldDefinition(
                id="field_state_of_formation",
                label="State of Formation / Registration",
                field_type="dropdown",
                required=True,
                help_text="State where the business entity was officially organized.",
                options=["Delaware", "Wyoming", "California", "New York", "Texas", "Florida", "Nevada", "Illinois", "Other US State"],
                validation=FieldValidationRules(
                    options=["Delaware", "Wyoming", "California", "New York", "Texas", "Florida", "Nevada", "Illinois", "Other US State"]
                )
            ),
            WorkflowFieldDefinition(
                id="field_accounting_software",
                label="Primary Accounting Platform",
                field_type="dropdown",
                required=True,
                help_text="Current software used for general ledger and bookkeeping.",
                options=["QuickBooks Online (QBO)", "Xero", "FreshBooks", "Wave Accounting", "QuickBooks Desktop", "NetSuite", "Excel Spreadsheets", "None / Setup Needed"],
                validation=FieldValidationRules(
                    options=["QuickBooks Online (QBO)", "Xero", "FreshBooks", "Wave Accounting", "QuickBooks Desktop", "NetSuite", "Excel Spreadsheets", "None / Setup Needed"]
                )
            ),
            WorkflowFieldDefinition(
                id="field_fiscal_year_end",
                label="Tax Year-End Date",
                field_type="dropdown",
                required=True,
                help_text="Corporate tax year-end closing month.",
                options=["December 31 (Calendar Year)", "March 31", "June 30", "September 30", "October 31", "Other"],
                validation=FieldValidationRules(
                    options=["December 31 (Calendar Year)", "March 31", "June 30", "September 30", "October 31", "Other"]
                )
            ),
            WorkflowFieldDefinition(
                id="field_primary_contact",
                label="Managing Member / Officer Full Name",
                field_type="short_text",
                required=True,
                help_text="Authorized officer or managing owner."
            ),
            WorkflowFieldDefinition(
                id="field_contact_email",
                label="Primary Business & Accounting Email",
                field_type="email",
                required=True,
                help_text="Email for monthly financial delivery, reconciliation queries, and approvals."
            ),
            WorkflowFieldDefinition(
                id="field_contact_phone",
                label="Contact Phone Number",
                field_type="phone",
                required=True,
                help_text="US telephone number with area code."
            ),
            WorkflowFieldDefinition(
                id="field_principal_address",
                label="Principal Business Address",
                field_type="long_text",
                required=True,
                help_text="Street address, city, state, and ZIP code."
            ),
            WorkflowFieldDefinition(
                id="field_bookkeeping_requirements",
                label="Bookkeeping Service Requirements & Accounts Overview",
                field_type="long_text",
                required=False,
                help_text="List active bank accounts, credit card lines, payment processors (Stripe/PayPal), and any monthly transaction estimates."
            ),
            WorkflowFieldDefinition(
                id="field_engagement_agreement",
                label="Bookkeeping Engagement Terms & Bank Read-Only Authorization",
                field_type="checkbox",
                required=True,
                help_text="Client engagement and third-party financial records access authorization.",
                options=["We authorize the accounting firm to perform monthly bookkeeping, reconcile bank and credit card accounts, access accounting software, and certify that all submitted records are authentic and complete."],
                validation=FieldValidationRules(
                    options=["We authorize the accounting firm to perform monthly bookkeeping, reconcile bank and credit card accounts, access accounting software, and certify that all submitted records are authentic and complete."]
                )
            )
        ]

    else:
        # Standard UK/US Financial & Bookkeeping Intake
        name = workflow_name or "Client Bookkeeping & Financial Onboarding Packet"
        category = vendor_category if vendor_category and vendor_category != "General" else "Bookkeeping & Accounting"
        desc = description or "Comprehensive client onboarding workflow for UK and US businesses collecting corporate formation documents, bank statements, tax IDs, and prior year financials."
        fields = [
            WorkflowFieldDefinition(
                id="field_business_name",
                label="Client Legal Entity Name",
                field_type="short_text",
                required=True,
                help_text="Registered legal business name.",
                validation=FieldValidationRules(min_length=2, max_length=150)
            ),
            WorkflowFieldDefinition(
                id="field_country_jurisdiction",
                label="Primary Operating Country",
                field_type="dropdown",
                required=True,
                options=["United States (US)", "United Kingdom (UK)", "Dual Operation (US & UK)"],
                validation=FieldValidationRules(
                    options=["United States (US)", "United Kingdom (UK)", "Dual Operation (US & UK)"]
                )
            ),
            WorkflowFieldDefinition(
                id="field_accounting_platform",
                label="Accounting Software Used",
                field_type="dropdown",
                required=True,
                options=["QuickBooks Online", "Xero", "FreshBooks", "Sage", "Excel / Manual", "Need Platform Setup"],
                validation=FieldValidationRules(
                    options=["QuickBooks Online", "Xero", "FreshBooks", "Sage", "Excel / Manual", "Need Platform Setup"]
                )
            ),
            WorkflowFieldDefinition(
                id="field_contact_name",
                label="Primary Contact Person",
                field_type="short_text",
                required=True,
                help_text="Authorized business representative."
            ),
            WorkflowFieldDefinition(
                id="field_contact_email",
                label="Accounting Email Address",
                field_type="email",
                required=True,
                help_text="Primary email for financial reports and monthly reconciliations."
            ),
            WorkflowFieldDefinition(
                id="field_contact_phone",
                label="Contact Telephone Number",
                field_type="phone",
                required=True
            ),
            WorkflowFieldDefinition(
                id="field_services_needed",
                label="Bookkeeping Services Requested",
                field_type="dropdown",
                required=True,
                options=["Full Monthly Bookkeeping & Reconciliations", "Year-End Financials & Tax Prep", "Catch-up / Backlog Cleanup (Prior Years)", "VAT / Sales Tax Filing Only", "Payroll & 1099/P60 Management"],
                validation=FieldValidationRules(
                    options=["Full Monthly Bookkeeping & Reconciliations", "Year-End Financials & Tax Prep", "Catch-up / Backlog Cleanup (Prior Years)", "VAT / Sales Tax Filing Only", "Payroll & 1099/P60 Management"]
                )
            ),
            WorkflowFieldDefinition(
                id="field_engagement_declaration",
                label="Client Engagement & Data Accuracy Declaration",
                field_type="checkbox",
                required=True,
                options=["I certify that all business information, statutory tax documents, and financial statements provided are accurate, and authorize the bookkeeping practice to perform accounting reconciliations."],
                validation=FieldValidationRules(
                    options=["I certify that all business information, statutory tax documents, and financial statements provided are accurate, and authorize the bookkeeping practice to perform accounting reconciliations."]
                )
            )
        ]

    # --- DYNAMIC DOCUMENT UPLOAD PARSER FOR UK & US BOOKKEEPING ---
    existing_field_ids = {f.id for f in fields}

    doc_rules = [
        # US Tax & Entity Documents
        (
            ("w-9", "w9", "w-8", "w8ben", "taxpayer id"),
            "field_doc_w9",
            "IRS Form W-9 / W-8BEN (Taxpayer Identification)",
            "US Tax Documents",
            False,
            "Signed IRS Form W-9 Request for Taxpayer Identification Number or Form W-8BEN (PDF)."
        ),
        (
            ("ein", "cp 575", "147c", "federal tax id letter"),
            "field_doc_ein_letter",
            "IRS EIN Confirmation Letter (CP 575 / 147C)",
            "US Tax Documents",
            False,
            "Official IRS confirmation letter assigning the Employer Identification Number."
        ),
        (
            ("articles of organization", "certificate of formation", "articles of incorporation", "formation certificate"),
            "field_doc_us_formation",
            "State Certificate of Formation / Articles of Organization",
            "US Corporate Documents",
            False,
            "Official stamped Articles of Organization or Certificate of Incorporation from Secretary of State."
        ),
        (
            ("operating agreement", "bylaws", "corporate bylaws"),
            "field_doc_operating_agreement",
            "Executed Operating Agreement / Corporate Bylaws",
            "US Corporate Documents",
            False,
            "Signed LLC Operating Agreement or Corporate Bylaws detailing ownership structure."
        ),

        # UK Statutory & HMRC Documents
        (
            ("companies house", "incorporation certificate", "certificate of incorporation", "crn"),
            "field_doc_uk_incorporation",
            "Companies House Certificate of Incorporation",
            "UK Statutory Documents",
            False,
            "Official Registrar of Companies certificate confirming company registration."
        ),
        (
            ("memorandum", "articles of association", "maa"),
            "field_doc_uk_articles",
            "Memorandum & Articles of Association (MAA)",
            "UK Statutory Documents",
            False,
            "Official Memorandum and Articles of Association registered with Companies House."
        ),
        (
            ("utr", "corporation tax notice", "hmrc utr", "unique taxpayer reference"),
            "field_doc_uk_utr",
            "HMRC Corporation Tax UTR Confirmation Letter",
            "UK Tax Documents",
            False,
            "Official HMRC letter confirming the company 10-digit Unique Taxpayer Reference (UTR)."
        ),
        (
            ("vat certificate", "vat registration", "vat 484", "uk vat"),
            "field_doc_uk_vat",
            "HMRC VAT Registration Certificate (VAT 484)",
            "UK Tax Documents",
            False,
            "Official HMRC VAT certificate showing VAT registration number and effective date."
        ),

        # Banking, Credit Cards & Merchant Statements (US & UK)
        (
            ("bank statement", "12 months bank", "6 months bank", "checking account", "bank statements", "business bank"),
            "field_doc_bank_statements",
            "Business Bank Account Statements (Last 6-12 Months)",
            "Banking & Statements",
            False,
            "Monthly PDF bank statements covering checking and savings accounts for all active business accounts."
        ),
        (
            ("voided check", "bank proof", "direct deposit form", "bank verification letter"),
            "field_doc_voided_check",
            "Voided Check / Official Bank Verification Letter",
            "Banking & Statements",
            False,
            "Voided business check or bank confirmation letter verifying routing & account numbers."
        ),
        (
            ("credit card", "credit card statements", "amex", "chase"),
            "field_doc_credit_card_statements",
            "Corporate Credit Card Statements (Last 6-12 Months)",
            "Banking & Statements",
            False,
            "Monthly credit card statements for all company cardholders used for business expenditures."
        ),
        (
            ("stripe", "paypal", "square", "shopify", "merchant statement", "payment processor"),
            "field_doc_merchant_statements",
            "Merchant Processor Settlement Reports (Stripe / PayPal / Square)",
            "Merchant Accounts",
            False,
            "Monthly payout, fee, and gross sales summary reports from payment gateways."
        ),

        # Prior Tax Returns & Financial Statements (US & UK)
        (
            ("prior tax", "tax return", "1120", "1120-s", "1065", "1040", "ct600", "corporation tax return"),
            "field_doc_prior_tax_returns",
            "Prior Year Tax Returns (Form 1120 / 1065 / CT600)",
            "Prior Tax Returns",
            False,
            "Complete copies of federal/statutory tax returns filed for the last 1-3 tax assessment years."
        ),
        (
            ("financial statement", "balance sheet", "p&l", "profit and loss", "trial balance", "general ledger"),
            "field_doc_financial_statements",
            "Year-End Balance Sheet & Profit and Loss (P&L)",
            "Financial Statements",
            False,
            "Year-end financial statements, trial balance, and general ledger export from prior year."
        ),
        (
            ("chart of accounts", "accounting export", "quickbooks backup", "xero export"),
            "field_doc_chart_of_accounts",
            "Chart of Accounts / Accounting Software Export",
            "Accounting System",
            False,
            "Chart of accounts list or trial balance export from previous accounting software."
        ),

        # Payroll Reports (US 941/W-2 & UK PAYE/P60)
        (
            ("payroll report", "941", "940", "w-2", "w2", "1099", "1099-nec", "paye", "p60", "fps"),
            "field_doc_payroll_reports",
            "Payroll Tax Reports (IRS Form 941 / W-2 or UK PAYE / P60)",
            "Payroll & Wage Reports",
            False,
            "Quarterly federal Form 941, annual Form 940, W-2 summary, or UK PAYE P60/P45/FPS filings."
        ),

        # Sales Tax & VAT Filings
        (
            ("sales tax", "resale certificate", "exemption certificate", "state tax"),
            "field_doc_sales_tax_exemption",
            "State Sales Tax Exemption / Resale Certificate",
            "Sales Tax & VAT",
            True,
            "Current state sales tax license, resale exemption certificate, or multi-state registration."
        ),
        (
            ("vat return", "mtd return", "quarterly vat"),
            "field_doc_vat_returns",
            "Quarterly VAT Return Summaries (MTD)",
            "Sales Tax & VAT",
            False,
            "Last 4 quarters of VAT return summaries submitted via Making Tax Digital (MTD)."
        ),

        # KYC, ID & Engagement
        (
            ("passport", "driving licence", "driver license", "photo id", "director id", "kyc"),
            "field_doc_director_id",
            "Director / Managing Member Government Photo ID (Passport / Driver's License)",
            "KYC & Identification",
            True,
            "Color copy of valid passport or state driver's license / UK photocard driving licence."
        ),
        (
            ("proof of address", "utility bill", "council tax"),
            "field_doc_proof_of_address",
            "Director Proof of Residential Address (< 3 Months Old)",
            "KYC & Identification",
            False,
            "Recent utility bill, bank statement, or council tax bill verifying residential address."
        ),
        (
            ("engagement letter", "engagement agreement", "service agreement"),
            "field_doc_engagement_letter",
            "Executed Bookkeeping Services Engagement Letter",
            "Engagement & Legal",
            False,
            "Signed professional engagement letter and standard terms of bookkeeping service."
        )
    ]

    for keywords, field_id, label, doc_cat, track_exp, help_text in doc_rules:
        if any(k in p_lower for k in keywords) and field_id not in existing_field_ids:
            fields.append(
                WorkflowFieldDefinition(
                    id=field_id,
                    label=label,
                    field_type="file_upload",
                    required=True,
                    help_text=help_text,
                    document_category=doc_cat,
                    track_expiry=track_exp or ("expiry" in p_lower and any(k in p_lower for k in keywords)),
                    allowed_file_types=["application/pdf", "image/png", "image/jpeg", "text/csv", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
                    max_file_size_mb=20
                )
            )
            existing_field_ids.add(field_id)

    # Always ensure primary financial documents exist if none detected by keywords
    has_bank = any("bank" in f.id for f in fields)
    if not has_bank:
        fields.append(
            WorkflowFieldDefinition(
                id="field_doc_bank_statements",
                label="Business Bank Account Statements (Last 6 Months)",
                field_type="file_upload",
                required=True,
                help_text="Official bank statements for checking and savings accounts used for business operations.",
                document_category="Banking & Statements",
                track_expiry=False,
                allowed_file_types=["application/pdf", "image/png", "text/csv"],
                max_file_size_mb=20
            )
        )

    has_tax_doc = any(f.id in ("field_doc_w9", "field_doc_uk_utr", "field_doc_uk_incorporation", "field_doc_ein_letter") for f in fields)
    if not has_tax_doc:
        if is_uk:
            fields.append(
                WorkflowFieldDefinition(
                    id="field_doc_uk_incorporation",
                    label="Companies House Certificate of Incorporation",
                    field_type="file_upload",
                    required=True,
                    help_text="Official certificate of company registration from Companies House.",
                    document_category="UK Statutory Documents",
                    track_expiry=False,
                    allowed_file_types=["application/pdf", "image/png", "image/jpeg"],
                    max_file_size_mb=15
                )
            )
        else:
            fields.append(
                WorkflowFieldDefinition(
                    id="field_doc_w9",
                    label="IRS Form W-9 / Taxpayer Identification Form",
                    field_type="file_upload",
                    required=True,
                    help_text="Completed and signed IRS Form W-9 confirming US legal entity name and EIN.",
                    document_category="US Tax Documents",
                    track_expiry=False,
                    allowed_file_types=["application/pdf", "image/png", "image/jpeg"],
                    max_file_size_mb=15
                )
            )

    # Parse reminder intervals
    reminder_rules = [30, 7, 1]
    days_matches = re.findall(r"(\d+)\s*days?", p_lower)
    if days_matches:
        parsed_days = sorted(list(set(int(d) for d in days_matches)), reverse=True)
        if parsed_days:
            reminder_rules = parsed_days

    # Parse approval requirement
    approval_required = True
    if any(k in p_lower for k in ("no approval", "auto-approve", "auto approve", "immediate pass")):
        approval_required = False

    assumptions = [
        "Standard file upload ceiling set to 20MB supporting PDF, CSV, Excel, PNG, and JPEG formats.",
        "Set mandatory CPA / Bookkeeper review prior to finalizing client onboarding.",
        "Configured automated reminder cadence for expiring director IDs or annual engagement letters.",
        "Deterministic UK & US bookkeeping compliance generator activated."
    ]

    warnings = [
        "Client bank statements and tax filings must be verified against official accounting registers.",
        "Expiring director IDs or sales tax licenses require valid expiration dates upon submission.",
        "Ensure bank feed authorizations (Plaid/Direct Feed) are coordinated with the client."
    ]

    generated_questions = [
        f"Do you require multi-currency reconciliations or international transfer tracking for {category}?",
        "Should the client be invited directly to your QuickBooks Online or Xero firm portal upon approval?"
    ]

    return WorkflowSchemaDefinition(
        name=name,
        vendor_category=category,
        description=desc,
        fields=fields,
        approval_required=approval_required,
        reminder_rules=reminder_rules,
        generated_questions=generated_questions,
        assumptions=assumptions,
        warnings=warnings
    )

def repair_truncated_json(raw: str) -> Optional[dict]:
    """
    Attempts to parse JSON from local LLM outputs.
    If the output was cut off mid-string or had unclosed brackets due to token limits,
    repairs unterminated strings, trailing commas, and unclosed brackets/braces.
    """
    if not raw or not isinstance(raw, str):
        return None

    cleaned = raw.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    if cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    cleaned = cleaned.strip()

    try:
        return json.loads(cleaned)
    except Exception:
        pass

    first_brace = cleaned.find("{")
    if first_brace != -1:
        cleaned = cleaned[first_brace:]

    try:
        return json.loads(cleaned)
    except Exception:
        pass

    def close_brackets(text: str) -> str:
        stack = []
        in_s = False
        esc = False
        for ch in text:
            if ch == "\\" and not esc:
                esc = True
                continue
            if ch == '"' and not esc:
                in_s = not in_s
            elif not in_s:
                if ch in ("{", "["):
                    stack.append(ch)
                elif ch in ("}", "]"):
                    if stack:
                        stack.pop()
            esc = False
        closing = ""
        while stack:
            top = stack.pop()
            closing += "}" if top == "{" else "]"
        return text + closing

    # Check for unterminated string
    in_string = False
    escape = False
    for ch in cleaned:
        if ch == "\\" and not escape:
            escape = True
            continue
        if ch == '"' and not escape:
            in_string = not in_string
        escape = False

    s = cleaned
    if in_string:
        s += '"'

    # Attempt 1: Close string and brackets
    try:
        return json.loads(close_brackets(s))
    except Exception:
        pass

    # Attempt 2: Strip trailing incomplete key/value or comma and close
    trimmed = re.sub(r',\s*("[^"]*")?\s*:\s*("[^"]*)?$', '', s)
    trimmed = re.sub(r',\s*("[^"]*)?$', '', trimmed)
    trimmed = re.sub(r',\s*$', '', trimmed)
    try:
        return json.loads(close_brackets(trimmed))
    except Exception:
        pass

    # Attempt 3: Look for the last complete field or valid object in "fields" array
    last_obj_match = list(re.finditer(r'\{[^{}]*\}', cleaned))
    if last_obj_match:
        end_pos = last_obj_match[-1].end()
        fallback_str = cleaned[:end_pos]
        try:
            return json.loads(close_brackets(fallback_str))
        except Exception:
            pass

    return None

async def _generate_with_ollama(
    prompt: str,
    workflow_name: Optional[str] = None,
    vendor_category: Optional[str] = "General",
    description: Optional[str] = None
) -> Optional[WorkflowSchemaDefinition]:
    """
    Generate workflow schema using local Ollama model (e.g. gemma4:e4b).
    Uses streamlined prompt and expanded context/token headroom to prevent truncation.
    """
    import httpx
    system_instruction = """You are an Enterprise Form Systems Architect. Convert user requirements into a single valid JSON object.
Allowed field_types: short_text, long_text, email, phone, dropdown, checkbox, date, file_upload.
Rules:
1. Provide realistic non-empty 'options' for dropdown and checkbox (2-6 options).
2. Set 'track_expiry=true' ONLY for renewable/expiring documents (licenses, permits, insurance, visas, passports).
3. Output pure JSON matching the requested schema. No commentary.

JSON Keys:
- "name": string
- "vendor_category": string (e.g. Human Resources, Healthcare, Real Estate, Education, Legal, Logistics, General)
- "description": string
- "approval_required": boolean (default true)
- "reminder_rules": list of integers (e.g. [30, 7, 1])
- "fields": list of field objects:
  {"id": "field_name", "label": "Label", "field_type": "...", "required": true, "track_expiry": false, "document_category": "...", "options": [... or null], "help_text": "..."}
- "generated_questions": list of strings
- "assumptions": list of strings
- "warnings": list of strings
"""

    user_content = (
        f"Requirements Prompt:\n{prompt}\n\n"
        f"Provided Metadata:\n"
        f"- Workflow Name: {workflow_name or 'Auto-generate'}\n"
        f"- Category / Industry: {vendor_category or 'General'}\n"
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
            "temperature": 0.1,
            "num_ctx": 8192,
            "num_predict": 4096
        }
    }

    url = f"{settings.OLLAMA_BASE_URL.rstrip('/')}/api/chat"
    timeout_config = httpx.Timeout(settings.OLLAMA_TIMEOUT_SECONDS, connect=30.0)
    async with httpx.AsyncClient(timeout=timeout_config) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()
        res_data = response.json()
        content = res_data.get("message", {}).get("content", "").strip() or res_data.get("response", "").strip()

        # Clean markdown code blocks if the model wraps output in fences
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()

        parsed_data = None
        try:
            parsed_data = json.loads(content)
        except Exception as json_err:
            logger.warning(f"Ollama direct JSON parse failed ({json_err}). Attempting automatic JSON repair on truncated output...")
            parsed_data = repair_truncated_json(content)
            if not parsed_data:
                raise json_err

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
                        if not f.get("id") or not isinstance(f.get("id"), str):
                            f["id"] = f"field_{idx}_{abs(hash(f.get('label', 'doc')))}"
                        if f.get("track_expiry") is None or isinstance(f.get("track_expiry"), dict):
                            f["track_expiry"] = False
                        if f.get("required") is None or isinstance(f.get("required"), dict):
                            f["required"] = True

                        # Clean validation if model echoed schema definitions
                        val = f.get("validation")
                        if isinstance(val, dict):
                            clean_val = {}
                            if isinstance(val.get("pattern"), str) and val.get("pattern").strip():
                                clean_val["pattern"] = val["pattern"].strip()
                            if isinstance(val.get("min_length"), int):
                                clean_val["min_length"] = val["min_length"]
                            if isinstance(val.get("max_length"), int):
                                clean_val["max_length"] = val["max_length"]
                            if isinstance(val.get("options"), list):
                                clean_val["options"] = [str(o) for o in val["options"] if isinstance(o, (str, int))]
                            f["validation"] = clean_val if clean_val else None

                        if f.get("field_type") in ("dropdown", "checkbox"):
                            val_dict = f.get("validation") if isinstance(f.get("validation"), dict) else {}
                            raw_opts = f.get("options") or val_dict.get("options") or []
                            clean_opts = [str(o).strip() for o in raw_opts if str(o).strip()]
                            if clean_opts:
                                f["options"] = clean_opts
                                if not isinstance(f.get("validation"), dict):
                                    f["validation"] = {"options": clean_opts}
                                else:
                                    f["validation"]["options"] = clean_opts

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
        f"- Category / Industry: {vendor_category or 'General'}\n"
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
        data = None
        try:
            data = json.loads(text)
        except Exception:
            data = repair_truncated_json(text)

        if not data or not isinstance(data, dict):
            return None

        if "fields" in data and isinstance(data["fields"], list):
            for idx, f in enumerate(data["fields"]):
                if isinstance(f, dict):
                    if not f.get("id"):
                        f["id"] = f"field_{idx}_{abs(hash(f.get('label', 'doc')))}"
                    if f.get("field_type") in ("dropdown", "checkbox"):
                        val_dict = f.get("validation") if isinstance(f.get("validation"), dict) else {}
                        raw_opts = f.get("options") or val_dict.get("options") or []
                        clean_opts = [str(o).strip() for o in raw_opts if str(o).strip()]
                        if clean_opts:
                            f["options"] = clean_opts
                            if "validation" not in f or not isinstance(f["validation"], dict):
                                f["validation"] = {"options": clean_opts}
                            else:
                                f["validation"]["options"] = clean_opts

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
    2. If failed: Local Ollama (gemma4:e4b)
    3. If failed: OpenAI (If configured)
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
            logger.warning(f"Tier 1 (Gemini 3.5: {primary_model}) failed: {type(e).__name__} - {e}. Falling back to Ollama.")

    # --- 2. SECOND: OLLAMA LOCAL MODEL ---
    if settings.OLLAMA_ENABLED:
        try:
            logger.info(f"Tier 2: Checking form generation via local Ollama ({settings.OLLAMA_MODEL})...")
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
            logger.warning(f"Tier 2 (Local Ollama: {settings.OLLAMA_MODEL}) failed: {type(e).__name__} - {e}. Falling back to final safeguard.")

    # --- 3. THIRD: OPENAI (If configured) ---
    if settings.OPENAI_API_KEY:
        try:
            logger.info(f"Checking form generation via OpenAI API (model: {settings.OPENAI_MODEL})...")
            from openai import OpenAI
            client = OpenAI(api_key=settings.OPENAI_API_KEY)
            user_content = (
                f"Requirements Prompt:\n{prompt}\n\n"
                f"Provided Metadata:\n"
                f"- Workflow Name: {workflow_name or 'Auto-generate'}\n"
                f"- Category / Industry: {vendor_category or 'General'}\n"
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

    # --- 4. FINAL SAFEGUARD: DETERMINISTIC GENERATOR ---
    logger.info("All LLM services failed or unavailable. Using intelligent deterministic fallback generator.")
    return generate_deterministic_fallback(prompt, workflow_name, vendor_category, description)
