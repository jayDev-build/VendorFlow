import os
import sys

os.environ["ENVIRONMENT"] = "test"
os.environ["DATABASE_URL"] = "sqlite:///./test_formgate.db"
os.environ["OPENAI_API_KEY"] = ""

import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add backend directory to sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.core.database import Base, get_db
from app.main import app
from app.models.models import Organization, User, Vendor, Document, NotificationJob, InvitationToken
from app.services.ai_workflow_generator import generate_deterministic_fallback, generate_workflow_from_requirements
from app.services.notification_service import notification_service
from app.core.security import generate_secure_token, hash_token

# Test database
TEST_DB_URL = "sqlite:///./test_formgate.db"
test_engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    from app.core.config import settings
    settings.OPENAI_API_KEY = ""
    settings.OLLAMA_ENABLED = False
    settings.RESEND_API_KEY = ""
    notification_service.resend_api_key = None
    notification_service.smtp_host = None
    notification_service.smtp_user = None
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)
    if os.path.exists("./test_formgate.db"):
        try:
            os.remove("./test_formgate.db")
        except Exception:
            pass

@pytest.fixture
def client():
    return TestClient(app)

def test_ai_workflow_parser_schema():
    prompt = (
        "Onboard new US LLC client for monthly bookkeeping. Collect IRS Form W-9, "
        "EIN confirmation letter CP 575, 12 months business checking bank statements, "
        "and prior year corporate tax return Form 1120-S. "
        "All documents require administrator approval. Send reminders 30 days before filing deadline."
    )
    schema = generate_deterministic_fallback(
        prompt=prompt,
        workflow_name="US Corporate Client Bookkeeping Onboarding",
        vendor_category="US Accounting & Bookkeeping"
    )

    assert schema.name == "US Corporate Client Bookkeeping Onboarding"
    assert schema.approval_required is True
    assert 30 in schema.reminder_rules
    assert len(schema.fields) >= 5

    # Check that bank statements or tax forms are file uploads
    w9_field = next((f for f in schema.fields if "w9" in f.id.lower() or "w-9" in f.label.lower()), None)
    assert w9_field is not None
    assert w9_field.field_type == "file_upload"

    # Check bank statement field
    bank_field = next((f for f in schema.fields if "bank" in f.id.lower()), None)
    assert bank_field is not None
    assert bank_field.field_type == "file_upload"

def test_universal_ai_workflow_parser_industries():
    # 1. Test US Bookkeeping & Tax Onboarding
    us_prompt = "Onboard new Delaware LLC client for monthly bookkeeping with IRS Form W-9, EIN letter, and QuickBooks Online sync."
    us_schema = generate_deterministic_fallback(us_prompt)
    assert us_schema.vendor_category == "US Accounting & Bookkeeping"
    field_types = {f.field_type for f in us_schema.fields}
    assert "email" in field_types
    assert "phone" in field_types
    assert "dropdown" in field_types
    assert "checkbox" in field_types
    assert "file_upload" in field_types

    # 2. Test UK Limited Company & Year-End Accounts
    uk_prompt = "Onboard UK private limited company (Ltd) for annual statutory accounts, Companies House CRN, and HMRC UTR."
    uk_schema = generate_deterministic_fallback(uk_prompt)
    assert uk_schema.vendor_category == "UK Accounting & Bookkeeping"
    crn_field = next(f for f in uk_schema.fields if "company_number" in f.id or "crn" in f.label.lower())
    assert crn_field is not None
    assert any(f.field_type == "file_upload" for f in uk_schema.fields)

    # 3. Test Payroll & Wage Compliance
    payroll_prompt = "Client payroll compliance onboarding with Form 941, W-2 reporting, and direct deposit wage withholdings."
    payroll_schema = generate_deterministic_fallback(payroll_prompt)
    assert payroll_schema.vendor_category == "Payroll & Wage Compliance"
    assert any("payroll" in f.id.lower() for f in payroll_schema.fields)

def test_repair_truncated_json_recovers_model_output():
    from app.services.ai_workflow_generator import repair_truncated_json
    # Simulate exact local Ollama unterminated string cutoff
    truncated_llm_output = (
        '{"name": "US Client Bookkeeping & Tax Onboarding", '
        '"vendor_category": "US Accounting & Bookkeeping", '
        '"fields": [{"id": "field_doc_w9", "label": "IRS Form W-9 Signed", "field_type": "file_upload", "track_expiry": false}], '
        '"warnings": ["Please verify that the EIN matches IRS records and legal entity'
    )
    repaired = repair_truncated_json(truncated_llm_output)
    assert repaired is not None
    assert repaired["name"] == "US Client Bookkeeping & Tax Onboarding"
    assert len(repaired["fields"]) == 1
    assert repaired["fields"][0]["id"] == "field_doc_w9"

def test_user_signup_and_auth(client):
    signup_data = {
        "email": "admin@acmecorp.com",
        "password": "StrongPassword123!",
        "full_name": "Alice Administrator",
        "organization_name": "Acme Corp",
        "business_profile": {"industry": "Manufacturing"}
    }
    res = client.post("/api/v1/auth/signup", json=signup_data)
    assert res.status_code == 201
    data = res.json()
    assert "access_token" in data
    assert data["user"]["email"] == "admin@acmecorp.com"
    assert data["organization"]["name"] == "Acme Corp"

    # Login test
    login_res = client.post("/api/v1/auth/login", json={"email": "admin@acmecorp.com", "password": "StrongPassword123!"})
    assert login_res.status_code == 200
    assert "access_token" in login_res.json()

def test_tenant_isolation(client):
    # Create Org A
    res_a = client.post("/api/v1/auth/signup", json={
        "email": "admin_a@tenant-a.com",
        "password": "Password123!",
        "full_name": "Admin A",
        "organization_name": "Tenant A Corp"
    })
    token_a = res_a.json()["access_token"]

    # Create Org B
    res_b = client.post("/api/v1/auth/signup", json={
        "email": "admin_b@tenant-b.com",
        "password": "Password123!",
        "full_name": "Admin B",
        "organization_name": "Tenant B Corp"
    })
    token_b = res_b.json()["access_token"]

    # Admin A creates a vendor in Org A
    headers_a = {"Authorization": f"Bearer {token_a}"}
    create_v_res = client.post("/api/v1/vendors", json={
        "name": "Secret Vendor A",
        "category": "Raw Materials",
        "contact_email": "vendor@secret.com"
    }, headers=headers_a)
    assert create_v_res.status_code == 201
    vendor_a_id = create_v_res.json()["id"]

    # Admin B attempts to access Org A's vendor
    headers_b = {"Authorization": f"Bearer {token_b}"}
    access_attempt = client.get(f"/api/v1/vendors/{vendor_a_id}", headers=headers_b)
    # Must be forbidden 403
    assert access_attempt.status_code == 403

def test_workflow_lifecycle_and_invitation(client):
    # Login as Admin A
    login_res = client.post("/api/v1/auth/login", json={"email": "admin_a@tenant-a.com", "password": "Password123!"})
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Generate workflow definition from requirements
    gen_res = client.post("/api/v1/workflows/generate", json={
        "prompt": "Collect GST certificate, PAN card, and insurance certificate. Insurance must have expiry date.",
        "workflow_name": "Supplier Standard Onboarding",
        "vendor_category": "Logistics"
    }, headers=headers)
    assert gen_res.status_code == 200
    schema_def = gen_res.json()

    # Create Workflow Template
    create_wf_res = client.post("/api/v1/workflows", json={
        "name": "Supplier Standard Onboarding",
        "vendor_category": "Logistics",
        "description": "Standard compliance for logistics partners",
        "schema_definition": schema_def,
        "approval_required": True,
        "reminder_rules": [30, 7, 1]
    }, headers=headers)
    assert create_wf_res.status_code == 201
    wf = create_wf_res.json()
    wf_id = wf["id"]

    # Publish Workflow
    pub_res = client.post(f"/api/v1/workflows/{wf_id}/publish", headers=headers)
    assert pub_res.status_code == 200
    assert pub_res.json()["status"] == "PUBLISHED"

    # Create invitation for a vendor
    invite_res = client.post(f"/api/v1/workflows/{wf_id}/invitations", json={
        "email": "supplier@transport.com",
        "vendor_name": "Apex Transport LLC",
        "vendor_category": "Logistics"
    }, headers=headers)
    assert invite_res.status_code == 200
    invitation = invite_res.json()
    raw_token = invitation["invitation_url"].split("/vendor/onboard/")[-1]

    # Vendor visits public invitation portal
    portal_res = client.get(f"/api/v1/public/invitations/{raw_token}")
    assert portal_res.status_code == 200
    portal_data = portal_res.json()
    assert portal_data["valid"] is True
    assert portal_data["organization_name"] == "Tenant A Corp"

    # Upload document to public invitation
    file_content = b"%PDF-1.4 simulated pdf test content"
    upload_res = client.post(
        f"/api/v1/public/invitations/{raw_token}/documents",
        data={
            "field_id": "field_doc_insurance",
            "document_type": "Commercial Liability Insurance",
            "expiry_date": (datetime.now(timezone.utc) + timedelta(days=25)).strftime("%Y-%m-%d")
        },
        files={"file": ("insurance_cert.pdf", file_content, "application/pdf")}
    )
    assert upload_res.status_code == 200
    doc_data = upload_res.json()
    assert doc_data["status"] == "SUBMITTED"
    doc_id = doc_data["document_id"]

    # Admin reviews and approves document
    review_res = client.post(f"/api/v1/documents/{doc_id}/approve", headers=headers)
    assert review_res.status_code == 200
    assert review_res.json()["status"] == "APPROVED"

def test_reminder_idempotency_and_deduplication():
    db = TestingSessionLocal()
    try:
        org = db.query(Organization).first()
        vendor = db.query(Vendor).first()
        doc = db.query(Document).first()

        idempotency_key = f"test_idempotency_{doc.id}_30d"

        # First call
        job1 = notification_service.record_and_send_notification(
            db=db,
            organization_id=org.id,
            vendor_id=vendor.id,
            document_id=doc.id,
            notification_type="EXPIRY_REMINDER",
            recipient_email=vendor.contact_email,
            subject="Test Reminder",
            body_text="Test notification body",
            idempotency_key=idempotency_key
        )
        assert job1.status == "SENT"

        # Second call with same idempotency key must not duplicate
        job2 = notification_service.record_and_send_notification(
            db=db,
            organization_id=org.id,
            vendor_id=vendor.id,
            document_id=doc.id,
            notification_type="EXPIRY_REMINDER",
            recipient_email=vendor.contact_email,
            subject="Test Reminder",
            body_text="Test notification body",
            idempotency_key=idempotency_key
        )
        assert job2.id == job1.id

        total_jobs = db.query(NotificationJob).filter(NotificationJob.idempotency_key == idempotency_key).count()
        assert total_jobs == 1
    finally:
        db.close()

def test_document_rejection_and_dashboard_stats(client):
    # Login as Admin A
    login_res = client.post("/api/v1/auth/login", json={"email": "admin_a@tenant-a.com", "password": "Password123!"})
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Query documents
    docs_res = client.get("/api/v1/documents", headers=headers)
    assert docs_res.status_code == 200
    docs = docs_res.json()
    assert len(docs) > 0
    doc_id = docs[0]["id"]

    # Reject document without reason (should fail)
    fail_reject = client.post(f"/api/v1/documents/{doc_id}/reject", json={"action": "REJECT", "reason": ""}, headers=headers)
    assert fail_reject.status_code == 400

    # Reject document with required reason
    reject_res = client.post(
        f"/api/v1/documents/{doc_id}/reject",
        json={"action": "REJECT", "reason": "Certificate is blurred and policy number is unreadable."},
        headers=headers
    )
    assert reject_res.status_code == 200
    assert reject_res.json()["status"] == "REJECTED"

    # Check dashboard stats
    stats_res = client.get("/api/v1/dashboard/stats", headers=headers)
    assert stats_res.status_code == 200
    stats = stats_res.json()
    assert stats["total_vendors"] >= 1
    assert "pending_reviews" in stats
    assert "upcoming_expirations" in stats

    # Check expiry tracker
    expiry_res = client.get("/api/v1/expiry", headers=headers)
    assert expiry_res.status_code == 200
    expiry_data = expiry_res.json()
    assert "expiring_30d" in expiry_data or "expired" in expiry_data

def test_workflow_deletion(client):
    # Register test admin
    signup_res = client.post("/api/v1/auth/signup", json={
        "email": "wf_deleter@tenant-del.com",
        "password": "Password123!",
        "full_name": "Deleter Admin",
        "organization_name": "Deleter Tenant"
    })
    assert signup_res.status_code == 201
    token = signup_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create a new draft workflow to test deletion
    create_wf = client.post("/api/v1/workflows", json={
        "name": "Temporary Deletable Workflow",
        "vendor_category": "Temporary",
        "description": "To be deleted immediately",
        "schema_definition": {
            "name": "Temporary Workflow",
            "vendor_category": "Temporary",
            "fields": [
                {
                    "id": "field_test",
                    "label": "Test Field",
                    "field_type": "short_text",
                    "required": False
                }
            ],
            "approval_required": True,
            "reminder_rules": [30, 7]
        },
        "approval_required": True,
        "reminder_rules": [30, 7]
    }, headers=headers)
    assert create_wf.status_code == 201
    wf_id = create_wf.json()["id"]

    # Delete the workflow
    del_res = client.delete(f"/api/v1/workflows/{wf_id}", headers=headers)
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True

    # Verify workflow is gone
    get_res = client.get(f"/api/v1/workflows/{wf_id}", headers=headers)
    assert get_res.status_code == 404

def test_workflow_edit_draft_and_published_versioning(client):
    # Register test admin
    signup_res = client.post("/api/v1/auth/signup", json={
        "email": "editor@versioncorp.com",
        "password": "Password123!",
        "full_name": "Editor Admin",
        "organization_name": "Version Corp"
    })
    assert signup_res.status_code == 201
    token = signup_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create a DRAFT workflow (v1)
    create_wf = client.post("/api/v1/workflows", json={
        "name": "Versioned Workflow",
        "vendor_category": "Logistics",
        "description": "Initial draft",
        "schema_definition": {
            "name": "Versioned Workflow",
            "vendor_category": "Logistics",
            "fields": [
                {
                    "id": "field_initial",
                    "label": "Initial Certificate",
                    "field_type": "file_upload",
                    "required": True,
                    "track_expiry": False
                }
            ],
            "approval_required": True,
            "reminder_rules": [30, 7]
        },
        "approval_required": True,
        "reminder_rules": [30, 7]
    }, headers=headers)
    assert create_wf.status_code == 201
    wf_data = create_wf.json()
    wf_id = wf_data["id"]
    assert wf_data["status"] == "DRAFT"
    assert wf_data["current_version_number"] == 1

    # 2. Edit the DRAFT workflow in-place (should stay v1)
    patch_draft = client.patch(f"/api/v1/workflows/{wf_id}", json={
        "name": "Versioned Workflow (Draft Edited)",
        "schema_definition": {
            "name": "Versioned Workflow (Draft Edited)",
            "vendor_category": "Logistics",
            "fields": [
                {
                    "id": "field_initial",
                    "label": "Initial Certificate (Updated)",
                    "field_type": "file_upload",
                    "required": True,
                    "track_expiry": True
                }
            ],
            "approval_required": True,
            "reminder_rules": [30, 7, 1]
        }
    }, headers=headers)
    assert patch_draft.status_code == 200
    updated_draft = patch_draft.json()
    assert updated_draft["name"] == "Versioned Workflow (Draft Edited)"
    assert updated_draft["current_version_number"] == 1  # In-place update for DRAFT!

    # 3. Publish the workflow
    pub_res = client.post(f"/api/v1/workflows/{wf_id}/publish", headers=headers)
    assert pub_res.status_code == 200
    pub_data = pub_res.json()
    assert pub_data["status"] == "PUBLISHED"
    assert pub_data["current_version_number"] == 1

    # 4. Edit the PUBLISHED workflow (should auto-increment to v2!)
    patch_pub = client.patch(f"/api/v1/workflows/{wf_id}", json={
        "name": "Versioned Workflow V2",
        "schema_definition": {
            "name": "Versioned Workflow V2",
            "vendor_category": "Logistics",
            "fields": [
                {
                    "id": "field_initial",
                    "label": "Initial Certificate",
                    "field_type": "file_upload",
                    "required": True,
                    "track_expiry": True
                },
                {
                    "id": "field_tax_id",
                    "label": "New Tax ID Field",
                    "field_type": "short_text",
                    "required": True,
                    "track_expiry": False
                }
            ],
            "approval_required": True,
            "reminder_rules": [30, 7, 1]
        }
    }, headers=headers)
    assert patch_pub.status_code == 200
    v2_data = patch_pub.json()
    assert v2_data["current_version_number"] == 2  # Incremented to v2!
    assert len(v2_data["schema_definition"]["fields"]) == 2

def test_admin_profile_editing(client):
    # 1. Sign up a new user
    signup_data = {
        "email": "testadmin_edit@formgate.io",
        "password": "Password123!",
        "full_name": "Admin Before Edit",
        "organization_name": "FormGate Test Org",
        "business_profile": {"industry": "IT & Cloud"}
    }
    res = client.post("/api/v1/auth/signup", json=signup_data)
    assert res.status_code == 201
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Update admin full_name and email
    patch_res = client.patch("/api/v1/auth/me", json={
        "full_name": "Admin After Edit",
        "email": "testadmin_updated@formgate.io"
    }, headers=headers)
    assert patch_res.status_code == 200
    user_data = patch_res.json()
    assert user_data["full_name"] == "Admin After Edit"
    assert user_data["email"] == "testadmin_updated@formgate.io"

    # 3. Update password
    pw_res = client.patch("/api/v1/auth/me", json={
        "current_password": "Password123!",
        "new_password": "NewSecretPassword123!"
    }, headers=headers)
    assert pw_res.status_code == 200

    # 4. Verify login with new credentials succeeds
    login_res = client.post("/api/v1/auth/login", json={
        "email": "testadmin_updated@formgate.io",
        "password": "NewSecretPassword123!"
    })
    assert login_res.status_code == 200
    assert login_res.json()["user"]["full_name"] == "Admin After Edit"

    # 5. Verify wrong current_password returns 400
    fail_res = client.patch("/api/v1/auth/me", json={
        "current_password": "WrongPassword!",
        "new_password": "AnotherPassword123!"
    }, headers=headers)
    assert fail_res.status_code == 400

def test_resubmission_and_rejection_link_generation(client):
    # Register admin & org
    signup_res = client.post("/api/v1/auth/signup", json={
        "email": "link_test_admin@tenant-links.com",
        "password": "Password123!",
        "full_name": "Link Admin",
        "organization_name": "Link Tenant"
    })
    assert signup_res.status_code == 201
    headers = {"Authorization": f"Bearer {signup_res.json()['access_token']}"}

    # Create workflow
    create_wf = client.post("/api/v1/workflows", json={
        "name": "Audit Resubmit Flow",
        "vendor_category": "Logistics",
        "description": "Workflow for testing resubmission links",
        "schema_definition": {
            "name": "Audit Resubmit Flow",
            "vendor_category": "Logistics",
            "fields": [
                {
                    "id": "field_doc_insurance",
                    "label": "Insurance Certificate",
                    "field_type": "file_upload",
                    "required": True,
                    "allowed_file_types": ["application/pdf"]
                }
            ],
            "approval_required": True,
            "reminder_rules": [30, 7]
        },
        "approval_required": True,
        "reminder_rules": [30, 7]
    }, headers=headers)
    assert create_wf.status_code == 201
    wf_id = create_wf.json()["id"]

    # Publish workflow
    client.post(f"/api/v1/workflows/{wf_id}/publish", headers=headers)

    # Invite vendor
    invite_res = client.post(f"/api/v1/workflows/{wf_id}/invitations", json={
        "email": "driver@apexhaulage.com",
        "vendor_name": "Apex Haulage LLC",
        "vendor_category": "Logistics"
    }, headers=headers)
    assert invite_res.status_code == 200
    initial_url = invite_res.json()["invitation_url"]
    raw_token = initial_url.split("/vendor/onboard/")[-1]

    # Vendor uploads document
    upload_res = client.post(
        f"/api/v1/public/invitations/{raw_token}/documents",
        data={
            "field_id": "field_doc_insurance",
            "document_type": "Insurance Certificate"
        },
        files={"file": ("insurance.pdf", b"%PDF-1.4 sample content", "application/pdf")}
    )
    assert upload_res.status_code == 200
    doc_id = upload_res.json()["document_id"]

    # Submit onboarding
    submit_res = client.post(f"/api/v1/public/invitations/{raw_token}/submit", json={
        "form_responses": {}
    })
    assert submit_res.status_code == 200

    # Verify initially submitted status is SUBMITTED
    portal_res = client.get(f"/api/v1/public/invitations/{raw_token}")
    assert portal_res.status_code == 200
    assert portal_res.json()["is_submitted"] is True

    # 1. Admin requests resubmission
    resubmit_res = client.post(
        f"/api/v1/documents/{doc_id}/request-resubmission",
        json={"action": "REQUEST_RESUBMISSION", "reason": "Please provide the updated 2026 endorsement page."},
        headers=headers
    )
    assert resubmit_res.status_code == 200
    resubmit_data = resubmit_res.json()
    assert resubmit_data["status"] == "RESUBMISSION_REQUESTED"
    assert "resubmission_url" in resubmit_data
    assert "/portal/" in resubmit_data["resubmission_url"] or "/vendor/onboard/" in resubmit_data["resubmission_url"]

    # Extract fresh resubmission token from returned URL
    resub_token = resubmit_data["resubmission_url"].split("/portal/")[-1] if "/portal/" in resubmit_data["resubmission_url"] else resubmit_data["resubmission_url"].split("/vendor/onboard/")[-1]

    # Vendor visits portal using new resubmission token
    portal_res2 = client.get(f"/api/v1/public/invitations/{resub_token}")
    assert portal_res2.status_code == 200
    p2_data = portal_res2.json()
    assert p2_data["is_submitted"] is False
    assert p2_data["submission_status"] == "RESUBMISSION_REQUESTED"
    assert len(p2_data["existing_documents"]) == 1
    assert p2_data["existing_documents"][0]["status"] == "RESUBMISSION_REQUESTED"
    assert p2_data["existing_documents"][0]["review_reason"] == "Please provide the updated 2026 endorsement page."

    # 2. Test Document Rejection link generation as well
    reject_res = client.post(
        f"/api/v1/documents/{doc_id}/reject",
        json={"action": "REJECT", "reason": "Document completely illegible."},
        headers=headers
    )
    assert reject_res.status_code == 200
    reject_data = reject_res.json()
    assert reject_data["status"] == "REJECTED"
    assert "resubmission_url" in reject_data
    reject_token = reject_data["resubmission_url"].split("/portal/")[-1] if "/portal/" in reject_data["resubmission_url"] else reject_data["resubmission_url"].split("/vendor/onboard/")[-1]

    # Vendor visits portal via reject token
    portal_res3 = client.get(f"/api/v1/public/invitations/{reject_token}")
    assert portal_res3.status_code == 200
    p3_data = portal_res3.json()
    assert p3_data["is_submitted"] is False
    assert p3_data["submission_status"] == "RESUBMISSION_REQUESTED"
    assert p3_data["existing_documents"][0]["status"] == "REJECTED"
    assert p3_data["existing_documents"][0]["review_reason"] == "Document completely illegible."

def test_resubmission_preserves_prior_approved_documents(client):
    # Register admin & org
    signup_res = client.post("/api/v1/auth/signup", json={
        "email": "preserve_admin@tenant-preserve.com",
        "password": "Password123!",
        "full_name": "Preserve Admin",
        "organization_name": "Preserve Tenant"
    })
    assert signup_res.status_code == 201
    headers = {"Authorization": f"Bearer {signup_res.json()['access_token']}"}

    # Create workflow with TWO document fields: Doc A (Insurance) and Doc B (Tax ID)
    create_wf = client.post("/api/v1/workflows", json={
        "name": "Dual Doc Workflow",
        "vendor_category": "Logistics",
        "description": "Workflow with 2 documents to test approval preservation",
        "schema_definition": {
            "name": "Dual Doc Workflow",
            "vendor_category": "Logistics",
            "fields": [
                {
                    "id": "field_doc_a",
                    "label": "Document A (Insurance)",
                    "field_type": "file_upload",
                    "required": True,
                    "allowed_file_types": ["application/pdf"]
                },
                {
                    "id": "field_doc_b",
                    "label": "Document B (Tax ID)",
                    "field_type": "file_upload",
                    "required": True,
                    "allowed_file_types": ["application/pdf"]
                }
            ],
            "approval_required": True,
            "reminder_rules": [30, 7]
        },
        "approval_required": True,
        "reminder_rules": [30, 7]
    }, headers=headers)
    assert create_wf.status_code == 201
    wf_id = create_wf.json()["id"]

    # Publish workflow
    client.post(f"/api/v1/workflows/{wf_id}/publish", headers=headers)

    # Invite vendor
    invite_res = client.post(f"/api/v1/workflows/{wf_id}/invitations", json={
        "email": "vendor@dualhaul.com",
        "vendor_name": "Dual Haul Logistics",
        "vendor_category": "Logistics"
    }, headers=headers)
    assert invite_res.status_code == 200
    token1 = invite_res.json()["invitation_url"].split("/vendor/onboard/")[-1]

    # Vendor uploads Doc A and Doc B
    res_a = client.post(
        f"/api/v1/public/invitations/{token1}/documents",
        data={"field_id": "field_doc_a", "document_type": "Document A (Insurance)"},
        files={"file": ("insurance_v1.pdf", b"%PDF-1.4 insurance file", "application/pdf")}
    )
    assert res_a.status_code == 200
    doc_a_id = res_a.json()["document_id"]

    res_b = client.post(
        f"/api/v1/public/invitations/{token1}/documents",
        data={"field_id": "field_doc_b", "document_type": "Document B (Tax ID)"},
        files={"file": ("tax_id_v1.pdf", b"%PDF-1.4 tax id file", "application/pdf")}
    )
    assert res_b.status_code == 200
    doc_b_id = res_b.json()["document_id"]

    # Vendor submits onboarding initially
    sub_res = client.post(f"/api/v1/public/invitations/{token1}/submit", json={"form_responses": {}})
    assert sub_res.status_code == 200

    # Both documents are initially UNDER_REVIEW
    doc_a_check = client.get(f"/api/v1/documents/{doc_a_id}", headers=headers).json()
    doc_b_check = client.get(f"/api/v1/documents/{doc_b_id}", headers=headers).json()
    assert doc_a_check["status"] == "UNDER_REVIEW"
    assert doc_b_check["status"] == "UNDER_REVIEW"

    # Admin approves Doc A!
    appr_a = client.post(f"/api/v1/documents/{doc_a_id}/approve", headers=headers)
    assert appr_a.status_code == 200
    assert appr_a.json()["status"] == "APPROVED"

    # Admin requests resubmission for Doc B!
    resub_b = client.post(
        f"/api/v1/documents/{doc_b_id}/request-resubmission",
        json={"action": "REQUEST_RESUBMISSION", "reason": "Tax ID is expired or unreadable."},
        headers=headers
    )
    assert resub_b.status_code == 200
    resub_url = resub_b.json()["resubmission_url"]
    resub_token = resub_url.split("/portal/")[-1] if "/portal/" in resub_url else resub_url.split("/vendor/onboard/")[-1]

    # Vendor visits resubmission portal
    portal_res = client.get(f"/api/v1/public/invitations/{resub_token}")
    assert portal_res.status_code == 200
    portal_data = portal_res.json()
    assert portal_data["is_submitted"] is False
    assert portal_data["submission_status"] == "RESUBMISSION_REQUESTED"

    # Confirm existing documents on portal: Doc A is APPROVED, Doc B is RESUBMISSION_REQUESTED
    docs_by_field = {d["field_id"]: d for d in portal_data["existing_documents"]}
    assert docs_by_field["field_doc_a"]["status"] == "APPROVED"
    assert docs_by_field["field_doc_b"]["status"] == "RESUBMISSION_REQUESTED"

    # Vendor replaces ONLY Doc B (does NOT touch Doc A)
    replace_b = client.post(
        f"/api/v1/public/invitations/{resub_token}/documents",
        data={"field_id": "field_doc_b", "document_type": "Document B (Tax ID)"},
        files={"file": ("tax_id_v2_corrected.pdf", b"%PDF-1.4 updated tax id content", "application/pdf")}
    )
    assert replace_b.status_code == 200
    # Status MUST NOT change to SUBMITTED upon file upload - it remains RESUBMISSION_REQUESTED until submit is hit!
    assert replace_b.json()["status"] == "RESUBMISSION_REQUESTED"
    assert replace_b.json()["has_replacement"] is True

    # Visiting portal before submit MUST still show status as RESUBMISSION_REQUESTED with replacement attached!
    portal_before_submit = client.get(f"/api/v1/public/invitations/{resub_token}").json()
    docs_before_submit = {d["field_id"]: d for d in portal_before_submit["existing_documents"]}
    assert docs_before_submit["field_doc_b"]["status"] == "RESUBMISSION_REQUESTED"
    assert docs_before_submit["field_doc_b"]["has_replacement"] is True

    # Vendor resubmits onboarding (hits Submit)
    resub_submit = client.post(f"/api/v1/public/invitations/{resub_token}/submit", json={"form_responses": {}})
    assert resub_submit.status_code == 200

    # CRITICAL CHECK: Doc A MUST STILL BE APPROVED!
    doc_a_after = client.get(f"/api/v1/documents/{doc_a_id}", headers=headers).json()
    assert doc_a_after["status"] == "APPROVED", f"Expected APPROVED but got {doc_a_after['status']}"

    # Doc B is now UNDER_REVIEW
    doc_b_after = client.get(f"/api/v1/documents/{doc_b_id}", headers=headers).json()
    assert doc_b_after["status"] == "UNDER_REVIEW"

    # Check dashboard stats: pending_reviews should contain ONLY Doc B! Doc A should NOT be in pending reviews!
    dashboard_res = client.get("/api/v1/dashboard/stats", headers=headers)
    assert dashboard_res.status_code == 200
    pending_ids = [d["id"] for d in dashboard_res.json()["pending_reviews"]]
    assert doc_b_id in pending_ids
    assert doc_a_id not in pending_ids, "Prior approved Doc A should not appear in dashboard pending reviews!"

    # Filter documents by UNDER_REVIEW queue: only Doc B appears!
    review_queue = client.get("/api/v1/documents?status=UNDER_REVIEW", headers=headers).json()
    review_queue_ids = [d["id"] for d in review_queue]
    assert doc_b_id in review_queue_ids
    assert doc_a_id not in review_queue_ids, "Prior approved Doc A should not appear in UNDER_REVIEW queue!"

    # Now Admin approves Doc B
    appr_b = client.post(f"/api/v1/documents/{doc_b_id}/approve", headers=headers)
    assert appr_b.status_code == 200
    assert appr_b.json()["vendor_status"] == "APPROVED"


def test_organization_slug_update(client):
    # Register Org 1
    signup1 = client.post("/api/v1/auth/signup", json={
        "email": "org1_admin@example.com",
        "password": "Password123!",
        "full_name": "Org 1 Admin",
        "organization_name": "Org 1 Alpha"
    })
    assert signup1.status_code == 201
    headers1 = {"Authorization": f"Bearer {signup1.json()['access_token']}"}

    # Register Org 2
    signup2 = client.post("/api/v1/auth/signup", json={
        "email": "org2_admin@example.com",
        "password": "Password123!",
        "full_name": "Org 2 Admin",
        "organization_name": "Org 2 Beta"
    })
    assert signup2.status_code == 201
    headers2 = {"Authorization": f"Bearer {signup2.json()['access_token']}"}

    # Update Org 1 slug cleanly
    update_res = client.patch("/api/v1/auth/organization", json={
        "name": "Org 1 Renamed",
        "slug": "custom-alpha-tenant"
    }, headers=headers1)
    assert update_res.status_code == 200
    updated_data = update_res.json()
    assert updated_data["slug"] == "custom-alpha-tenant"
    assert updated_data["name"] == "Org 1 Renamed"

    # Attempt to update Org 2 to the same slug should fail with 400
    conflict_res = client.patch("/api/v1/auth/organization", json={
        "slug": "custom-alpha-tenant"
    }, headers=headers2)
    assert conflict_res.status_code == 400
    assert "already taken" in conflict_res.json()["detail"].lower()

    # Updating with spaces/special characters should automatically slugify
    slugify_res = client.patch("/api/v1/auth/organization", json={
        "slug": "Beta Logistics Hub!"
    }, headers=headers2)
    assert slugify_res.status_code == 200
    assert slugify_res.json()["slug"] == "beta-logistics-hub"


def test_same_vendor_new_invitations_are_fresh(client):
    # Signup a fresh Admin
    signup_res = client.post("/api/v1/auth/signup", json={
        "email": "fresh_admin@tenant-fresh.com",
        "password": "Password123!",
        "full_name": "Fresh Admin",
        "organization_name": "Fresh Forms Corp"
    })
    assert signup_res.status_code == 201
    token = signup_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create Workflow 1
    wf1_res = client.post("/api/v1/workflows", json={
        "name": "General Vendor Intake",
        "vendor_category": "General",
        "description": "General vendor intake form",
        "schema_definition": {
            "name": "General Vendor Intake",
            "vendor_category": "General",
            "approval_required": True,
            "reminder_rules": [30],
            "fields": [
                {"id": "field_tax_id", "label": "Tax ID", "field_type": "text", "required": False}
            ]
        },
        "approval_required": True,
        "reminder_rules": [30]
    }, headers=headers)
    assert wf1_res.status_code == 201
    wf1_id = wf1_res.json()["id"]
    client.post(f"/api/v1/workflows/{wf1_id}/publish", headers=headers)

    # 2. Create Workflow 2
    wf2_res = client.post("/api/v1/workflows", json={
        "name": "Security Compliance Check",
        "vendor_category": "IT",
        "description": "Security compliance form",
        "schema_definition": {
            "name": "Security Compliance Check",
            "vendor_category": "IT",
            "approval_required": True,
            "reminder_rules": [15],
            "fields": [
                {"id": "field_badge_no", "label": "Badge Number", "field_type": "text", "required": False}
            ]
        },
        "approval_required": True,
        "reminder_rules": [15]
    }, headers=headers)
    assert wf2_res.status_code == 201
    wf2_id = wf2_res.json()["id"]
    client.post(f"/api/v1/workflows/{wf2_id}/publish", headers=headers)

    vendor_email = "samuel@multivendor.com"

    # 3. Invite vendor to Workflow 1
    inv1_res = client.post(f"/api/v1/workflows/{wf1_id}/invitations", json={
        "email": vendor_email,
        "vendor_name": "Samuel Enterprise"
    }, headers=headers)
    assert inv1_res.status_code == 200
    token1 = inv1_res.json()["invitation_url"].split("/vendor/onboard/")[-1]

    # Vendor submits Workflow 1
    sub1_res = client.post(f"/api/v1/public/invitations/{token1}/submit", json={
        "form_responses": {"field_tax_id": "TAX-998877"},
        "document_expiries": {}
    })
    assert sub1_res.status_code == 200

    # Visiting token1 now shows is_submitted = True (Google Forms Edit Response screen)
    view1 = client.get(f"/api/v1/public/invitations/{token1}").json()
    assert view1["is_submitted"] is True
    assert view1["existing_responses"]["field_tax_id"] == "TAX-998877"

    # 4. Now invite the SAME vendor to Workflow 2
    inv2_res = client.post(f"/api/v1/workflows/{wf2_id}/invitations", json={
        "email": vendor_email,
        "vendor_name": "Samuel Enterprise"
    }, headers=headers)
    assert inv2_res.status_code == 200
    token2 = inv2_res.json()["invitation_url"].split("/vendor/onboard/")[-1]

    # Visiting token2 MUST be a fresh form! Not an edit response screen!
    view2 = client.get(f"/api/v1/public/invitations/{token2}").json()
    assert view2["is_submitted"] is False
    assert view2["existing_responses"] == {}
    assert view2["existing_documents"] == []

    # 5. Now send a new invitation to the SAME vendor for Workflow 1 (renewal)
    inv3_res = client.post(f"/api/v1/workflows/{wf1_id}/invitations", json={
        "email": vendor_email,
        "vendor_name": "Samuel Enterprise"
    }, headers=headers)
    assert inv3_res.status_code == 200
    token3 = inv3_res.json()["invitation_url"].split("/vendor/onboard/")[-1]

    # Visiting token3 MUST also be fresh!
    view3 = client.get(f"/api/v1/public/invitations/{token3}").json()
    assert view3["is_submitted"] is False
    assert view3["existing_responses"] == {}
    assert view3["existing_documents"] == []

def test_workflow_responses_endpoint_and_vendor_submissions(client):
    # 1. Signup and Auth
    auth_res = client.post("/api/v1/auth/signup", json={
        "email": "lead@workflow-responses.com",
        "password": "Password123!",
        "full_name": "Response Lead",
        "organization_name": "Responses Corp"
    }).json()
    headers = {"Authorization": f"Bearer {auth_res['access_token']}"}

    # 2. Create Workflow
    schema = {
        "name": "Vendor Audit Workflow",
        "vendor_category": "Logistics",
        "fields": [
            {"id": "field_company", "label": "Company Name", "field_type": "short_text", "required": True},
            {"id": "field_tax_id", "label": "Tax Registration ID", "field_type": "short_text", "required": True},
            {"id": "doc_cert", "label": "Registration Certificate", "field_type": "file_upload", "document_category": "Legal", "required": True}
        ],
        "approval_required": True,
        "reminder_rules": [7]
    }
    create_wf_res = client.post("/api/v1/workflows", json={
        "name": "Vendor Audit Workflow",
        "vendor_category": "Logistics",
        "description": "Compliance flow with responses table",
        "schema_definition": schema,
        "approval_required": True,
        "reminder_rules": [7]
    }, headers=headers)
    assert create_wf_res.status_code == 201
    wf = create_wf_res.json()
    wf_id = wf["id"]

    # Publish
    client.post(f"/api/v1/workflows/{wf_id}/publish", headers=headers)

    # 3. Initially, responses count is 0
    wf_list_before = client.get("/api/v1/workflows", headers=headers).json()
    target_wf = next(w for w in wf_list_before if w["id"] == wf_id)
    assert target_wf["responses_count"] == 0

    empty_resp = client.get(f"/api/v1/workflows/{wf_id}/responses", headers=headers).json()
    assert empty_resp["stats"]["total_responses"] == 0
    assert len(empty_resp["responses"]) == 0

    # 4. Invite Vendor and Submit Form + Document
    inv = client.post(f"/api/v1/workflows/{wf_id}/invitations", json={
        "email": "vendor@auditme.com",
        "vendor_name": "Audit Ready Ltd"
    }, headers=headers).json()
    token = inv["invitation_url"].split("/vendor/onboard/")[-1]

    # Submit Document
    doc_res = client.post(
        f"/api/v1/public/invitations/{token}/documents",
        data={
            "field_id": "doc_cert",
            "document_type": "Registration Certificate"
        },
        files={"file": ("cert.pdf", b"%PDF-1.4 sample cert", "application/pdf")}
    )
    assert doc_res.status_code == 200

    # Submit Form
    sub_res = client.post(f"/api/v1/public/invitations/{token}/submit", json={
        "form_responses": {
            "field_company": "Audit Ready Ltd",
            "field_tax_id": "TX-AUDIT-990"
        }
    })
    assert sub_res.status_code == 200

    # 5. Check Workflows List: responses_count is now 1
    wf_list_after = client.get("/api/v1/workflows", headers=headers).json()
    target_wf_after = next(w for w in wf_list_after if w["id"] == wf_id)
    assert target_wf_after["responses_count"] == 1

    # 6. Check Dedicated Responses Endpoint
    resp_data = client.get(f"/api/v1/workflows/{wf_id}/responses", headers=headers).json()
    assert resp_data["workflow"]["name"] == "Vendor Audit Workflow"
    assert resp_data["stats"]["total_responses"] == 1
    assert resp_data["stats"]["pending_review"] == 1
    assert len(resp_data["responses"]) == 1

    submission = resp_data["responses"][0]
    assert submission["vendor_name"] == "Audit Ready Ltd"
    assert submission["vendor_email"] == "vendor@auditme.com"
    assert submission["form_responses"]["field_company"] == "Audit Ready Ltd"
    assert submission["form_responses"]["field_tax_id"] == "TX-AUDIT-990"
    assert len(submission["documents"]) == 1
    assert submission["documents"][0]["original_filename"] == "cert.pdf"

    # 7. Check Vendor Detail Page API includes submissions list for accordion
    vendor_id = submission["vendor_id"]
    vendor_data = client.get(f"/api/v1/vendors/{vendor_id}", headers=headers).json()
    assert "submissions" in vendor_data
    assert len(vendor_data["submissions"]) == 1
    v_sub = vendor_data["submissions"][0]
    assert v_sub["workflow_name"] == "Vendor Audit Workflow"
    assert v_sub["form_responses"]["field_company"] == "Audit Ready Ltd"
    assert len(v_sub["documents"]) == 1
    assert v_sub["documents"][0]["original_filename"] == "cert.pdf"

def test_direct_shareable_link_without_email(client):
    # Login as Admin A
    login_res = client.post("/api/v1/auth/login", json={"email": "admin_a@tenant-a.com", "password": "Password123!"})
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Fetch a published workflow
    wf_list = client.get("/api/v1/workflows", headers=headers).json()
    published_wf = [w for w in wf_list if w["status"] == "PUBLISHED"][0]

    # Generate invitation link without providing email (instant form link)
    invite_res = client.post(f"/api/v1/workflows/{published_wf['id']}/invitations", json={}, headers=headers)
    assert invite_res.status_code == 200
    data = invite_res.json()
    assert "invitation_url" in data
    assert "/vendor/onboard/" in data["invitation_url"]

    # Public portal should open cleanly
    raw_token = data["invitation_url"].split("/vendor/onboard/")[-1]
    portal_res = client.get(f"/api/v1/public/invitations/{raw_token}")
    assert portal_res.status_code == 200
    portal_data = portal_res.json()
    assert portal_data["valid"] is True
    assert portal_data["workflow_name"] == published_wf["name"]

def test_multi_form_document_rejection_routes_to_correct_workflow(client):
    # 1. Sign up independent Admin for this test
    signup_res = client.post("/api/v1/auth/signup", json={
        "email": "multi_admin@bookkeeping-uk.com",
        "password": "Password123!",
        "full_name": "Multi Admin",
        "organization_name": "Multi Form Accounting Ltd"
    })
    assert signup_res.status_code == 201
    token = signup_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Create Workflow F1 (KYC) with docs D1 and D2
    schema_f1 = {
        "name": "Bookkeeping Form 1 (KYC)",
        "vendor_category": "Accounting",
        "fields": [
            {"id": "field_name", "label": "Client Legal Name", "field_type": "short_text", "required": True},
            {"id": "doc_d1", "label": "Bank Statement", "field_type": "file_upload", "document_category": "Financial", "required": True},
            {"id": "doc_d2", "label": "Passport / ID", "field_type": "file_upload", "document_category": "Identification", "required": True}
        ],
        "approval_required": True
    }
    wf1_res = client.post("/api/v1/workflows", json={
        "name": "Bookkeeping Form 1 (KYC)",
        "vendor_category": "Accounting",
        "description": "Form 1 with D1 and D2",
        "schema_definition": schema_f1,
        "approval_required": True
    }, headers=headers)
    assert wf1_res.status_code == 201
    wf1_id = wf1_res.json()["id"]
    client.post(f"/api/v1/workflows/{wf1_id}/publish", headers=headers)

    # 3. Create Workflow F2 (Tax & VAT) with docs D3 and D4
    schema_f2 = {
        "name": "Bookkeeping Form 2 (Tax & VAT)",
        "vendor_category": "Accounting",
        "fields": [
            {"id": "field_tax_reg", "label": "Tax Registration Number", "field_type": "short_text", "required": True},
            {"id": "doc_d3", "label": "VAT Registration Certificate", "field_type": "file_upload", "document_category": "Tax", "required": True},
            {"id": "doc_d4", "label": "Annual Accounts", "field_type": "file_upload", "document_category": "Financial", "required": True}
        ],
        "approval_required": True
    }
    wf2_res = client.post("/api/v1/workflows", json={
        "name": "Bookkeeping Form 2 (Tax & VAT)",
        "vendor_category": "Accounting",
        "description": "Form 2 with D3 and D4",
        "schema_definition": schema_f2,
        "approval_required": True
    }, headers=headers)
    assert wf2_res.status_code == 201
    wf2_id = wf2_res.json()["id"]
    client.post(f"/api/v1/workflows/{wf2_id}/publish", headers=headers)

    # 4. Send F1 to client
    client_email = "dual_client@bookkeeping-uk.com"
    inv1_res = client.post(f"/api/v1/workflows/{wf1_id}/invitations", json={
        "email": client_email,
        "vendor_name": "Dual Flow Client Ltd"
    }, headers=headers)
    assert inv1_res.status_code == 200
    token_f1 = inv1_res.json()["invitation_url"].split("/vendor/onboard/")[-1]

    # Upload D1 and D2 for F1
    doc_d1_res = client.post(
        f"/api/v1/public/invitations/{token_f1}/documents",
        data={"field_id": "doc_d1", "document_type": "Bank Statement"},
        files={"file": ("bank_statement_v1.pdf", b"%PDF-1.4 D1 bank statement", "application/pdf")}
    )
    assert doc_d1_res.status_code == 200
    doc_d1_id = doc_d1_res.json()["document_id"]

    doc_d2_res = client.post(
        f"/api/v1/public/invitations/{token_f1}/documents",
        data={"field_id": "doc_d2", "document_type": "Passport / ID"},
        files={"file": ("passport_id.pdf", b"%PDF-1.4 D2 passport", "application/pdf")}
    )
    assert doc_d2_res.status_code == 200

    # Submit Form 1
    sub1_res = client.post(f"/api/v1/public/invitations/{token_f1}/submit", json={
        "form_responses": {"field_name": "Dual Flow Client Ltd"}
    })
    assert sub1_res.status_code == 200

    # 5. Later, send F2 to the SAME client
    inv2_res = client.post(f"/api/v1/workflows/{wf2_id}/invitations", json={
        "email": client_email,
        "vendor_name": "Dual Flow Client Ltd"
    }, headers=headers)
    assert inv2_res.status_code == 200
    token_f2 = inv2_res.json()["invitation_url"].split("/vendor/onboard/")[-1]

    # Upload D3 and D4 for F2
    doc_d3_res = client.post(
        f"/api/v1/public/invitations/{token_f2}/documents",
        data={"field_id": "doc_d3", "document_type": "VAT Registration Certificate"},
        files={"file": ("vat_cert.pdf", b"%PDF-1.4 D3 vat cert", "application/pdf")}
    )
    assert doc_d3_res.status_code == 200

    doc_d4_res = client.post(
        f"/api/v1/public/invitations/{token_f2}/documents",
        data={"field_id": "doc_d4", "document_type": "Annual Accounts"},
        files={"file": ("accounts.pdf", b"%PDF-1.4 D4 accounts", "application/pdf")}
    )
    assert doc_d4_res.status_code == 200

    # Submit Form 2
    sub2_res = client.post(f"/api/v1/public/invitations/{token_f2}/submit", json={
        "form_responses": {"field_tax_reg": "GB998877665"}
    })
    assert sub2_res.status_code == 200

    # 6. Admin rejects document D1 (which belongs to Form 1)
    reject_reason = "Bank statement is older than 3 months. Please upload recent one."
    reject_res = client.post(
        f"/api/v1/documents/{doc_d1_id}/reject",
        json={"action": "REJECT", "reason": reject_reason},
        headers=headers
    )
    assert reject_res.status_code == 200
    reject_data = reject_res.json()
    assert reject_data["status"] == "REJECTED"
    assert "resubmission_url" in reject_data
    assert reject_data["resubmission_url"] is not None

    # 7. Extract the resubmission token from the email link
    resub_token = reject_data["resubmission_url"].split("/portal/")[-1] if "/portal/" in reject_data["resubmission_url"] else reject_data["resubmission_url"].split("/vendor/onboard/")[-1]

    # 8. Open the client portal using the resubmission link
    portal_res = client.get(f"/api/v1/public/invitations/{resub_token}")
    assert portal_res.status_code == 200
    portal_data = portal_res.json()

    # CRITICAL ASSERTIONS:
    # A. The portal MUST display Form 1 (KYC), NOT the later Form 2!
    assert portal_data["workflow_name"] == "Bookkeeping Form 1 (KYC)"
    field_ids = [f["id"] for f in portal_data["schema_definition"]["fields"]]
    assert "doc_d1" in field_ids
    assert "doc_d2" in field_ids
    assert "doc_d3" not in field_ids
    assert "doc_d4" not in field_ids

    # B. The portal MUST show the rejected document with the reviewer reason
    assert len(portal_data["existing_documents"]) >= 1
    d1_item = next(d for d in portal_data["existing_documents"] if d["field_id"] == "doc_d1")
    assert d1_item["status"] == "REJECTED"
    assert d1_item["review_reason"] == reject_reason

    # C. Existing form response for Form 1 must be preserved
    assert portal_data["existing_responses"].get("field_name") == "Dual Flow Client Ltd"

    # 9. Client uploads replacement for D1 using the resubmission link
    replace_res = client.post(
        f"/api/v1/public/invitations/{resub_token}/documents",
        data={"field_id": "doc_d1", "document_type": "Bank Statement"},
        files={"file": ("recent_bank_statement.pdf", b"%PDF-1.4 replacement bank statement", "application/pdf")}
    )
    assert replace_res.status_code == 200
    assert replace_res.json()["document_id"] == doc_d1_id

    # 10. Client resubmits Form 1
    resubmit_res = client.post(
        f"/api/v1/public/invitations/{resub_token}/submit",
        json={"form_responses": {"field_name": "Dual Flow Client Ltd"}}
    )
    assert resubmit_res.status_code == 200

    # 11. Verify D1 status transitioned to UNDER_REVIEW
    d1_check = client.get(f"/api/v1/documents/{doc_d1_id}", headers=headers).json()
    assert d1_check["status"] == "UNDER_REVIEW"
    assert d1_check["original_filename"] == "recent_bank_statement.pdf"

def test_unified_client_portal_architecture(client):
    # 1. Sign up fresh admin
    signup_res = client.post("/api/v1/auth/signup", json={
        "email": "unified_admin@accounting.co.uk",
        "password": "Password123!",
        "full_name": "Portal Admin",
        "organization_name": "Unified Accounting LLP"
    })
    assert signup_res.status_code == 201
    token = signup_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Create Workflow 1 (KYC)
    wf1_res = client.post("/api/v1/workflows", json={
        "name": "Client KYC Intake",
        "vendor_category": "Accounting",
        "description": "Standard client identification and banking",
        "schema_definition": {
            "name": "Client KYC Intake",
            "vendor_category": "Accounting",
            "approval_required": True,
            "fields": [
                {"id": "field_corp_name", "label": "Company Legal Name", "field_type": "short_text", "required": True},
                {"id": "doc_bank_stmt", "label": "3-Month Bank Statement", "field_type": "file_upload", "required": True}
            ]
        },
        "approval_required": True
    }, headers=headers)
    assert wf1_res.status_code == 201
    wf1_id = wf1_res.json()["id"]
    client.post(f"/api/v1/workflows/{wf1_id}/publish", headers=headers)

    # 3. Create Workflow 2 (Tax & VAT)
    wf2_res = client.post("/api/v1/workflows", json={
        "name": "Corporate Tax & VAT Intake",
        "vendor_category": "Tax",
        "description": "HMRC corporate tax returns and VAT certificates",
        "schema_definition": {
            "name": "Corporate Tax & VAT Intake",
            "vendor_category": "Tax",
            "approval_required": True,
            "fields": [
                {"id": "field_vat_num", "label": "VAT Number", "field_type": "short_text", "required": True},
                {"id": "doc_vat_cert", "label": "VAT Certificate", "field_type": "file_upload", "required": True}
            ]
        },
        "approval_required": True
    }, headers=headers)
    assert wf2_res.status_code == 201
    wf2_id = wf2_res.json()["id"]
    client.post(f"/api/v1/workflows/{wf2_id}/publish", headers=headers)

    client_email = "direct_client@uk-enterprise.com"

    # 4. Invite client to Workflow 1
    inv1_res = client.post(f"/api/v1/workflows/{wf1_id}/invitations", json={
        "email": client_email,
        "vendor_name": "UK Enterprise Solutions"
    }, headers=headers)
    assert inv1_res.status_code == 200
    inv1_data = inv1_res.json()
    assert "portal_url" in inv1_data
    assert "/portal/" in inv1_data["portal_url"]
    portal_token_1 = inv1_data["portal_url"].split("/portal/")[-1]

    # 5. Later, invite SAME client to Workflow 2
    inv2_res = client.post(f"/api/v1/workflows/{wf2_id}/invitations", json={
        "email": client_email,
        "vendor_name": "UK Enterprise Solutions"
    }, headers=headers)
    assert inv2_res.status_code == 200
    inv2_data = inv2_res.json()
    portal_token_2 = inv2_data["portal_url"].split("/portal/")[-1]

    # CRITICAL: Both invitations must share the SAME unified portal_token!
    assert portal_token_1 == portal_token_2, "Client must have one persistent portal token across all forms!"
    portal_token = portal_token_1

    # 6. Fetch unified portal before submissions: shows 2 assignments in progress!
    portal_initial = client.get(f"/api/v1/portal/{portal_token}")
    assert portal_initial.status_code == 200
    p_data = portal_initial.json()
    assert p_data["valid"] is True
    assert p_data["client_name"] == "UK Enterprise Solutions"
    assert p_data["client_email"] == client_email
    assert len(p_data["action_required"]) == 0
    assert len(p_data["assignments"]) == 2

    assign1 = next(a for a in p_data["assignments"] if a["workflow_id"] == wf1_id)
    assign2 = next(a for a in p_data["assignments"] if a["workflow_id"] == wf2_id)
    assert assign1["workflow_name"] == "Client KYC Intake"
    assert assign2["workflow_name"] == "Corporate Tax & VAT Intake"

    # 7. Upload document and submit Form 1 via unified portal API
    upload1_res = client.post(
        f"/api/v1/portal/{portal_token}/assignments/{assign1['id']}/documents",
        data={"field_id": "doc_bank_stmt", "document_type": "3-Month Bank Statement"},
        files={"file": ("bank_stmt_initial.pdf", b"%PDF-1.4 bank statement", "application/pdf")}
    )
    assert upload1_res.status_code == 200
    doc1_id = upload1_res.json()["document_id"]
    assert upload1_res.json()["assignment_id"] == assign1["id"]

    sub1_res = client.post(
        f"/api/v1/portal/{portal_token}/assignments/{assign1['id']}/submit",
        json={"form_responses": {"field_corp_name": "UK Enterprise Solutions Ltd"}}
    )
    assert sub1_res.status_code == 200

    # 8. Upload document and submit Form 2 via unified portal API
    upload2_res = client.post(
        f"/api/v1/portal/{portal_token}/assignments/{assign2['id']}/documents",
        data={"field_id": "doc_vat_cert", "document_type": "VAT Certificate"},
        files={"file": ("vat_cert_initial.pdf", b"%PDF-1.4 vat cert", "application/pdf")}
    )
    assert upload2_res.status_code == 200
    doc2_id = upload2_res.json()["document_id"]
    assert upload2_res.json()["assignment_id"] == assign2["id"]

    sub2_res = client.post(
        f"/api/v1/portal/{portal_token}/assignments/{assign2['id']}/submit",
        json={"form_responses": {"field_vat_num": "GB112233445"}}
    )
    assert sub2_res.status_code == 200

    # 9. Admin rejects Form 1's document (doc1_id)
    reject_reason = "Statement page 2 is missing transactions."
    reject_res = client.post(
        f"/api/v1/documents/{doc1_id}/reject",
        json={"action": "REJECT", "reason": reject_reason},
        headers=headers
    )
    assert reject_res.status_code == 200
    resub_link = reject_res.json()["resubmission_url"]
    # Rejection link MUST point directly to the unified portal!
    assert f"/portal/{portal_token}" in resub_link

    # 10. Client re-opens unified portal:
    portal_after_reject = client.get(f"/api/v1/portal/{portal_token}").json()
    # At top of page: Action Required MUST contain exactly the rejected document!
    assert len(portal_after_reject["action_required"]) == 1
    action_item = portal_after_reject["action_required"][0]
    assert action_item["document_id"] == doc1_id
    assert action_item["document_type"] == "3-Month Bank Statement"
    assert action_item["workflow_name"] == "Client KYC Intake"
    assert action_item["review_reason"] == reject_reason
    assert action_item["status"] == "REJECTED"

    # Both assignments are still present below Action Required:
    assert len(portal_after_reject["assignments"]) == 2
    f2_assign = next(a for a in portal_after_reject["assignments"] if a["workflow_id"] == wf2_id)
    assert f2_assign["status"] == "SUBMITTED"
    assert len(f2_assign["existing_documents"]) == 1
    assert f2_assign["existing_documents"][0]["id"] == doc2_id

    # 11. Client re-uploads replacement for doc1 using unified portal endpoint
    replace_res = client.post(
        f"/api/v1/portal/{portal_token}/assignments/{assign1['id']}/documents",
        data={"field_id": "doc_bank_stmt", "document_type": "3-Month Bank Statement"},
        files={"file": ("bank_stmt_complete.pdf", b"%PDF-1.4 full statement", "application/pdf")}
    )
    assert replace_res.status_code == 200
    assert replace_res.json()["document_id"] == doc1_id
    assert replace_res.json()["has_replacement"] is True

    # 12. Client re-submits Form 1
    client.post(
        f"/api/v1/portal/{portal_token}/assignments/{assign1['id']}/submit",
        json={"form_responses": {"field_corp_name": "UK Enterprise Solutions Ltd"}}
    )

    # 13. Portal state is now clean: Action Required is empty, both forms submitted!
    portal_final = client.get(f"/api/v1/portal/{portal_token}").json()
    assert len(portal_final["action_required"]) == 0
    f1_final = next(a for a in portal_final["assignments"] if a["workflow_id"] == wf1_id)
    assert f1_final["status"] == "SUBMITTED"
    assert f1_final["existing_documents"][0]["original_filename"] == "bank_stmt_complete.pdf"
    assert f1_final["existing_documents"][0]["status"] == "UNDER_REVIEW"


def test_notifications_cc_user_email(client):
    from app.models.models import NotificationJob
    db = TestingSessionLocal()
    try:
        # 1. Sign up user
        user_email = "compliance_lead@firm.co.uk"
        signup_res = client.post("/api/v1/auth/signup", json={
            "email": user_email,
            "password": "Password123!",
            "full_name": "Compliance Lead",
            "organization_name": "Compliance Firm Ltd"
        })
        assert signup_res.status_code == 201
        headers = {"Authorization": f"Bearer {signup_res.json()['access_token']}"}

        # 2. Create and publish workflow
        wf_res = client.post("/api/v1/workflows", json={
            "name": "CC Notification Audit Workflow",
            "vendor_category": "Legal",
            "description": "Testing CC functionality on sending emails",
            "schema_definition": {
                "name": "CC Notification Audit Workflow",
                "vendor_category": "Legal",
                "fields": [
                    {"id": "doc_id_proof", "label": "ID Proof", "field_type": "file_upload", "required": True}
                ]
            },
            "approval_required": True
        }, headers=headers)
        assert wf_res.status_code == 201
        wf_id = wf_res.json()["id"]
        client.post(f"/api/v1/workflows/{wf_id}/publish", headers=headers)

        # 3. Send invitation to client
        client_email = "applicant_contact@external.com"
        inv_res = client.post(f"/api/v1/workflows/{wf_id}/invitations", json={
            "email": client_email,
            "vendor_name": "External Applicant"
        }, headers=headers)
        assert inv_res.status_code == 200

        # 4. Verify Invitation NotificationJob has user's email in CC
        inv_job = db.query(NotificationJob).filter(
            NotificationJob.recipient_email == client_email,
            NotificationJob.notification_type == "INVITATION"
        ).order_by(NotificationJob.created_at.desc()).first()
        assert inv_job is not None
        assert inv_job.cc_email == user_email

        # 5. Client uploads document and submits
        raw_token = inv_res.json()["invitation_url"].split("/vendor/onboard/")[-1]
        up_res = client.post(
            f"/api/v1/public/invitations/{raw_token}/documents",
            data={"field_id": "doc_id_proof", "document_type": "ID Proof"},
            files={"file": ("passport.pdf", b"%PDF-1.4 passport sample", "application/pdf")}
        )
        assert up_res.status_code == 200
        doc_id = up_res.json()["document_id"]

        client.post(f"/api/v1/public/invitations/{raw_token}/submit", json={"form_responses": {}})

        # 6. Admin rejects document
        reject_res = client.post(
            f"/api/v1/documents/{doc_id}/reject",
            json={"action": "REJECT", "reason": "Expired passport"},
            headers=headers
        )
        assert reject_res.status_code == 200

        # 7. Verify Rejection NotificationJob has user's email in CC
        reject_job = db.query(NotificationJob).filter(
            NotificationJob.document_id == doc_id,
            NotificationJob.notification_type == "DOCUMENT_REJECTED"
        ).order_by(NotificationJob.created_at.desc()).first()
        assert reject_job is not None
        assert reject_job.cc_email == user_email

        # 8. Admin requests resubmission
        resub_res = client.post(
            f"/api/v1/documents/{doc_id}/request-resubmission",
            json={"action": "REQUEST_RESUBMISSION", "reason": "Upload higher resolution copy"},
            headers=headers
        )
        assert resub_res.status_code == 200

        resub_job = db.query(NotificationJob).filter(
            NotificationJob.document_id == doc_id,
            NotificationJob.notification_type == "RESUBMISSION_REQUEST"
        ).order_by(NotificationJob.created_at.desc()).first()
        assert resub_job is not None
        assert resub_job.cc_email == user_email
    finally:
        db.close()


def test_health_endpoint_and_supabase_pooler_compatibility(client):
    from app.core.database import sanitize_db_url
    from app.core.config import settings

    # 1. Verify GET /health executes SELECT 1 and returns {"status": "ok"}
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}

    # 2. Verify GET /api/v1/health also reports status "ok"
    api_res = client.get("/api/v1/health")
    assert api_res.status_code == 200
    assert api_res.json()["status"] == "ok"

    # 3. Verify Supabase PostgreSQL Transaction Pooler URL normalization (port 6543, postgres:// prefix)
    raw_supabase_url = "postgres://postgres.dlueuhvrxzqptblhguwh:MyPassword%40123@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
    sanitized = sanitize_db_url(raw_supabase_url)
    assert sanitized.startswith("postgresql+psycopg2://")
    assert "pooler.supabase.com:6543" in sanitized
    assert "MyPassword%40123" in sanitized

    # 4. Verify FRONTEND_URL is configured and CORS responds properly to production & dev frontend origins
    assert settings.FRONTEND_URL is not None
    cors_prod = client.options(
        "/health",
        headers={
            "Origin": "https://formgate.in",
            "Access-Control-Request-Method": "GET"
        }
    )
    assert cors_prod.status_code == 200
    assert cors_prod.headers.get("access-control-allow-origin") == "https://formgate.in"

    cors_local = client.options(
        "/health",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET"
        }
    )
    assert cors_local.status_code == 200
    assert cors_local.headers.get("access-control-allow-origin") == "http://localhost:3000"











