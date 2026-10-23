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
            email="demo@vendorflow.io",
            hashed_password=get_password_hash("Password123!"),
            full_name="Sarah Jenkins",
            role="admin",
            is_active=True
        )
        db.add(admin)
        db.flush()

        # 3. Workflows
        # Workflow 1: Standard Supplier Onboarding
        prompt_1 = "Collect GST certificate, PAN card, business registration certificate, bank proof, and insurance certificate. Insurance must have an expiry date. Administrator approval required. Reminders 30 days before expiry."
        schema_1 = generate_deterministic_fallback(prompt_1, "Standard Supplier Compliance", "Supply Chain")

        wf_1 = WorkflowTemplate(
            organization_id=org.id,
            name="Standard Supplier Compliance",
            vendor_category="Supply Chain",
            description="Complete vendor onboarding and compliance verification for freight, supply chain, and logistics vendors.",
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

        # Workflow 2: IT & Software Services Onboarding
        prompt_2 = "Collect company registration, NDA agreement, bank account details, and ISO 27001 certificate. ISO certificate has expiration. 30 days reminder."
        schema_2 = generate_deterministic_fallback(prompt_2, "IT & Software Vendor Onboarding", "IT & Cloud Services")

        wf_2 = WorkflowTemplate(
            organization_id=org.id,
            name="IT & Software Vendor Onboarding",
            vendor_category="IT & Cloud Services",
            description="Security, confidentiality and banking validation for software, SaaS, and technology consultants.",
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

        # 4. Realistic Vendors
        # Vendor A: Approved Vendor
        v_a = Vendor(
            organization_id=org.id,
            name="Apex Fleet Logistics LLC",
            category="Supply Chain",
            contact_email="compliance@apexfleet.com",
            contact_phone="+1 (555) 234-5678",
            status="APPROVED",
            notes="Reliable long-haul freight carrier. Fully verified."
        )
        db.add(v_a)
        db.flush()

        # Documents for Vendor A
        d_a1 = Document(
            organization_id=org.id,
            vendor_id=v_a.id,
            field_id="field_doc_gst",
            document_type="GST / Tax Certificate",
            original_filename="apex_gst_cert.pdf",
            file_size=245000,
            mime_type="application/pdf",
            storage_path=f"{org.id}/{v_a.id}/gst_cert.pdf",
            status="APPROVED"
        )
        d_a2 = Document(
            organization_id=org.id,
            vendor_id=v_a.id,
            field_id="field_doc_insurance",
            document_type="Commercial Liability Insurance",
            original_filename="apex_liability_policy_2026.pdf",
            file_size=512000,
            mime_type="application/pdf",
            storage_path=f"{org.id}/{v_a.id}/insurance.pdf",
            expiry_date=now + timedelta(days=18), # Expiring in 18 days! Perfect for 30d expiry bucket
            status="APPROVED"
        )
        db.add_all([d_a1, d_a2])

        # Vendor B: Pending Review
        v_b = Vendor(
            organization_id=org.id,
            name="NexGen Cloud Solutions Inc.",
            category="IT & Cloud Services",
            contact_email="partners@nexgencloud.io",
            contact_phone="+1 (555) 890-1234",
            status="SUBMITTED",
            notes="Submitted compliance package today. Needs admin review."
        )
        db.add(v_b)
        db.flush()

        d_b1 = Document(
            organization_id=org.id,
            vendor_id=v_b.id,
            field_id="field_doc_business_reg",
            document_type="Certificate of Incorporation",
            original_filename="nexgen_incorporation.pdf",
            file_size=320000,
            mime_type="application/pdf",
            storage_path=f"{org.id}/{v_b.id}/incorp.pdf",
            status="UNDER_REVIEW"
        )
        d_b2 = Document(
            organization_id=org.id,
            vendor_id=v_b.id,
            field_id="field_doc_bank_proof",
            document_type="Bank Routing & Account Header",
            original_filename="nexgen_voided_check.pdf",
            file_size=180000,
            mime_type="application/pdf",
            storage_path=f"{org.id}/{v_b.id}/bank.pdf",
            status="UNDER_REVIEW"
        )
        db.add_all([d_b1, d_b2])

        # Vendor C: Expired Document Vendor
        v_c = Vendor(
            organization_id=org.id,
            name="Horizon Warehousing Partners",
            category="Supply Chain",
            contact_email="operations@horizonwarehouse.com",
            contact_phone="+1 (555) 456-7890",
            status="APPROVED",
            notes="Regional warehouse operator. Fire safety & insurance renewal overdue."
        )
        db.add(v_c)
        db.flush()

        d_c1 = Document(
            organization_id=org.id,
            vendor_id=v_c.id,
            field_id="field_doc_insurance",
            document_type="Warehouse Operating Insurance",
            original_filename="horizon_insurance_policy.pdf",
            file_size=420000,
            mime_type="application/pdf",
            storage_path=f"{org.id}/{v_c.id}/horizon_ins.pdf",
            expiry_date=now - timedelta(days=5), # Expired 5 days ago!
            status="EXPIRED"
        )
        db.add(d_c1)

        # Vendor D: Invited Vendor with active token
        v_d = Vendor(
            organization_id=org.id,
            name="Beacon Security Consultants",
            category="IT & Cloud Services",
            contact_email="legal@beaconsec.com",
            contact_phone="+1 (555) 789-0123",
            status="INVITED",
            notes="Invitation link sent. Awaiting vendor submission."
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
        print(f"Admin login: demo@vendorflow.io / Password123!")
        print(f"Sample Vendor Invitation Token: {raw_token}")

    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
