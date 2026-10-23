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

