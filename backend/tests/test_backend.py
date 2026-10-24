import os
import sys
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
TEST_DB_URL = "sqlite:///./test_vendorflow.db"
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
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)
    if os.path.exists("./test_vendorflow.db"):
        try:
            os.remove("./test_vendorflow.db")
        except Exception:
            pass

@pytest.fixture
def client():
    return TestClient(app)

def test_ai_workflow_parser_schema():
    prompt = (
        "Collect GST certificate, PAN card, business registration certificate, "
        "bank proof, and insurance certificate. Insurance must have an expiry date. "
        "All documents require administrator approval. Send reminders 30 days before expiry."
    )
    schema = generate_deterministic_fallback(
        prompt=prompt,
        workflow_name="Standard Vendor Onboarding",
        vendor_category="General"
    )

    assert schema.name == "Standard Vendor Onboarding"
    assert schema.approval_required is True
    assert 30 in schema.reminder_rules
    assert len(schema.fields) >= 5

    # Check that insurance has expiry tracking enabled
    insurance_field = next((f for f in schema.fields if "insurance" in f.id.lower() or "insurance" in f.label.lower()), None)
    assert insurance_field is not None
    assert insurance_field.track_expiry is True
    assert insurance_field.field_type == "file_upload"

    # Check GST and PAN are file uploads
    gst_field = next((f for f in schema.fields if "gst" in f.id.lower()), None)
    assert gst_field is not None
    assert gst_field.field_type == "file_upload"

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
    assert "/vendor/onboard/" in resubmit_data["resubmission_url"]

    # Extract fresh resubmission token from returned URL
    resub_token = resubmit_data["resubmission_url"].split("/vendor/onboard/")[-1]

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
    reject_token = reject_data["resubmission_url"].split("/vendor/onboard/")[-1]

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
    resub_token = resub_url.split("/vendor/onboard/")[-1]

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





