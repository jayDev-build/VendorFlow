import os
import sys

# Ensure backend root is on sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from datetime import datetime, timezone, timedelta
from app.core.database import SessionLocal, Base, engine
from app.core.security import get_password_hash, generate_secure_token, hash_token
from app.models.models import (
    Organization,
    User,
    Vendor,
    WorkflowTemplate,
    WorkflowVersion,
    VendorOnboarding,
    InvitationToken,
    Document,
    DocumentReview,
    ReminderRule,
    AuditLog,
)
from app.services.ai_workflow_generator import generate_deterministic_fallback

def seed_database():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Check if already seeded
        existing_org = db.query(Organization).filter(Organization.slug == "acme-logistics").first()
        if existing_org:
            print("Database already contains seed organization.")
            return

        print("Seeding realistic development data...")
        now = datetime.now(timezone.utc)

        # 1. Organization
        org = Organization(
            name="Acme Logistics & Enterprise Compliance",
            slug="acme-logistics",
            business_profile={
                "industry": "Supply Chain & Logistics",
                "headquarters": "San Francisco, CA",
                "compliance_tier": "Enterprise Tier 1"
            }
        )
        db.add(org)
        db.flush()

        # 2. Admin User
        admin = User(
            organization_id=org.id,
            email="admin@formgate.io",
            hashed_password=get_password_hash("Password123!"),
            full_name="Sarah Jenkins",
            role="admin",
            is_active=True
        )
        db.add(admin)
        db.flush()

        # 3. Workflows
        # Workflow 1: US Corporate Bookkeeping Onboarding
        prompt_1 = "Onboard US corporate bookkeeping client. Collect IRS Form W-9, IRS EIN confirmation letter CP 575, last 12 months business checking and credit card statements, and prior year corporate tax return Form 1120-S. Reminders 30 days before filing."
        schema_1 = generate_deterministic_fallback(prompt_1, "US Corporate Bookkeeping Onboarding", "US Accounting & Bookkeeping")

        wf_1 = WorkflowTemplate(
            organization_id=org.id,
            name="US Corporate Bookkeeping Onboarding",
            vendor_category="US Accounting & Bookkeeping",
            description="Complete bookkeeping onboarding for US LLCs and S-Corporations collecting IRS tax IDs, bank statements, and tax returns.",
            status="PUBLISHED"
        )
        db.add(wf_1)
        db.flush()

        ver_1 = WorkflowVersion(
            workflow_template_id=wf_1.id,
            organization_id=org.id,
            version_number=1,
            schema_definition=schema_1.model_dump(),
            approval_required=True,
            reminder_rules=[30, 7, 1],
            assumptions=schema_1.assumptions,
            warnings=schema_1.warnings
        )
        db.add(ver_1)
        db.flush()
        wf_1.current_version_id = ver_1.id

        # Workflow 2: UK Limited Company Bookkeeping Intake
        prompt_2 = "Onboard UK private limited company for monthly bookkeeping and annual statutory accounts. Collect Companies House Certificate of Incorporation, HMRC Corporation Tax UTR confirmation, and last 12 months UK business bank statements. 30 days reminder."
        schema_2 = generate_deterministic_fallback(prompt_2, "UK Limited Company Bookkeeping Intake", "UK Accounting & Bookkeeping")

        wf_2 = WorkflowTemplate(
            organization_id=org.id,
            name="UK Limited Company Bookkeeping Intake",
            vendor_category="UK Accounting & Bookkeeping",
            description="Statutory accounting, VAT MTD, and Companies House documentation packet for UK businesses.",
            status="PUBLISHED"
        )
        db.add(wf_2)
        db.flush()

        ver_2 = WorkflowVersion(
            workflow_template_id=wf_2.id,
            organization_id=org.id,
            version_number=1,
            schema_definition=schema_2.model_dump(),
            approval_required=True,
            reminder_rules=[30, 7, 1],
            assumptions=schema_2.assumptions,
            warnings=schema_2.warnings
        )
        db.add(ver_2)
        db.flush()
        wf_2.current_version_id = ver_2.id

        # 4. Realistic Clients
        # Client A: Approved Client
        v_a = Vendor(
            organization_id=org.id,
            name="Apex Cloud Media LLC",
            category="US Accounting & Bookkeeping",
            contact_email="finance@apexcloudmedia.com",
            contact_phone="+1 (415) 890-2134",
            status="APPROVED",
            notes="US S-Corporation client. Monthly bookkeeping and QuickBooks Online reconciliation."
        )
        db.add(v_a)
        db.flush()

        # Documents for Client A
        d_a1 = Document(
            organization_id=org.id,
            vendor_id=v_a.id,
            field_id="field_doc_w9",
            document_type="IRS Form W-9 (Taxpayer ID)",
            original_filename="apex_form_w9_signed.pdf",
            file_size=245000,
            mime_type="application/pdf",
            storage_path=f"{org.id}/{v_a.id}/apex_w9.pdf",
            status="APPROVED"
        )
        d_a2 = Document(
            organization_id=org.id,
            vendor_id=v_a.id,
            field_id="field_doc_bank_statements",
            document_type="Business Bank & Credit Card Statements",
            original_filename="apex_bank_statements_2026.pdf",
            file_size=512000,
            mime_type="application/pdf",
            storage_path=f"{org.id}/{v_a.id}/apex_bank.pdf",
            expiry_date=now + timedelta(days=18), # Expiring in 18 days! Perfect for 30d expiry bucket
            status="APPROVED"
        )
        db.add_all([d_a1, d_a2])

        # Client B: Pending Review
        v_b = Vendor(
            organization_id=org.id,
            name="Cotswold Commerce Ltd",
            category="UK Accounting & Bookkeeping",
            contact_email="accounts@cotswoldcommerce.co.uk",
            contact_phone="+44 20 7946 0912",
            status="SUBMITTED",
            notes="UK Ltd company. Submitted Companies House incorporation & UTR for annual accounts preparation."
        )
        db.add(v_b)
        db.flush()

        d_b1 = Document(
            organization_id=org.id,
            vendor_id=v_b.id,
            field_id="field_doc_companies_house",
            document_type="Companies House Certificate of Incorporation",
            original_filename="cotswold_crn_certificate.pdf",
            file_size=320000,
            mime_type="application/pdf",
            storage_path=f"{org.id}/{v_b.id}/crn_cert.pdf",
            status="UNDER_REVIEW"
        )
        d_b2 = Document(
            organization_id=org.id,
            vendor_id=v_b.id,
            field_id="field_doc_hmrc_utr",
            document_type="HMRC Corporation Tax UTR Notice",
            original_filename="cotswold_hmrc_utr.pdf",
            file_size=180000,
            mime_type="application/pdf",
            storage_path=f"{org.id}/{v_b.id}/utr_notice.pdf",
            status="UNDER_REVIEW"
        )
        db.add_all([d_b1, d_b2])

        # Client C: Expired Document
        v_c = Vendor(
            organization_id=org.id,
            name="Meridian Software Inc",
            category="US Sales Tax & E-commerce",
            contact_email="tax@meridiansoftware.com",
            contact_phone="+1 (212) 555-0198",
            status="APPROVED",
            notes="Multi-state e-commerce seller. State sales tax resale exemption certificate expired."
        )
        db.add(v_c)
        db.flush()

        d_c1 = Document(
            organization_id=org.id,
            vendor_id=v_c.id,
            field_id="field_doc_resale_cert",
            document_type="State Sales Tax Exemption Certificate",
            original_filename="meridian_resale_certificate.pdf",
            file_size=420000,
            mime_type="application/pdf",
            storage_path=f"{org.id}/{v_c.id}/resale_cert.pdf",
            expiry_date=now - timedelta(days=5), # Expired 5 days ago!
            status="EXPIRED"
        )
        db.add(d_c1)

        # Client D: Invited Client with active token
        v_d = Vendor(
            organization_id=org.id,
            name="Highland FinTech LLP",
            category="UK Accounting & Bookkeeping",
            contact_email="compliance@highlandfintech.co.uk",
            contact_phone="+44 131 496 0884",
            status="INVITED",
            notes="Onboarding invitation link dispatched for UK partnership bookkeeping."
        )
        db.add(v_d)
        db.flush()

        raw_token = "demo-invitation-token-beacon-2026"
        inv_token = InvitationToken(
            organization_id=org.id,
            workflow_version_id=ver_2.id,
            vendor_id=v_d.id,
            email="legal@beaconsec.com",
            token_hash=hash_token(raw_token),
            expires_at=now + timedelta(days=14),
            is_revoked=False
        )
        db.add(inv_token)

        # 5. Audit logs
        log1 = AuditLog(
            organization_id=org.id,
            user_id=admin.id,
            action="ORGANIZATION_INITIALIZED",
            entity_type="organization",
            entity_id=org.id,
            details={"admin": admin.email}
        )
        log2 = AuditLog(
            organization_id=org.id,
            user_id=admin.id,
            action="WORKFLOW_PUBLISHED",
            entity_type="workflow_template",
            entity_id=wf_1.id,
            details={"title": wf_1.name}
        )
        log3 = AuditLog(
            organization_id=org.id,
            user_id=admin.id,
            action="DOCUMENT_APPROVED",
            entity_type="document",
            entity_id=d_a1.id,
            details={"vendor": v_a.name, "doc": d_a1.document_type}
        )
        db.add_all([log1, log2, log3])

        db.commit()
        print("Demo seed data created successfully!")
        print(f"Admin login: admin@formgate.io / Password123!")
        print(f"Sample Vendor Invitation Token: {raw_token}")

    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
