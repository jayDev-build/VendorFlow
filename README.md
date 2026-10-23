# VendorFlow — AI-Powered Vendor Onboarding & Document Expiry SaaS

**VendorFlow** is an enterprise-grade vendor onboarding and compliance lifecycle management SaaS. It enables compliance managers to transform plain-English onboarding guidelines into structured, versioned digital workflows, securely collect and verify vendor certificates, and automatically monitor document expirations with idempotent background reminder schedules.

---

## 🌟 Key Product Features

### 1. AI-Powered Workflow Generator (Core Differentiator)
- **Natural Language Parsing**: Paste unformatted compliance instructions (e.g., *"Collect GST certificate, PAN card, business registration, bank proof, and liability insurance. Insurance must have an expiry date. Admin approval required. Send reminders 30 days before expiry"*).
- **Structured Pydantic Validation**: Uses OpenAI's structured outputs (`WorkflowSchemaDefinition`) to generate validated, typed form schemas.
- **Graceful Deterministic Fallback**: If `OPENAI_API_KEY` is not provided or in offline/demo mode, an intelligent heuristic fallback parser generates structured workflows with compliance warnings and assumptions.
- **Interactive Visual Builder**: Customize field labels, change types (Short text, Long text, Email, Phone, Dropdown, Date, Checkbox, Document upload), toggle required status, toggle expiry tracking, and reorder fields.
- **Workflow Versioning**: Workflows support `DRAFT`, `PUBLISHED`, and `ARCHIVED` states with auto-incrementing versions. Vendors onboarding on an existing version maintain schema stability.
- **Live Vendor Preview**: Managers can preview the interactive vendor experience before publishing.

### 2. Multi-Tenant Architecture & Security
- **Strict Server-Side Tenant Isolation**: All database queries and operations enforce organization scoping (`organization_id`). Changing an ID in an API request returns `403 Forbidden`.
- **Private Document Vault**: Uploaded vendor documents (PDF, PNG, JPEG) are saved with unpredictable UUID keys in an isolated storage directory. Direct public document links are prohibited.
- **Time-Limited Signed URLs**: Authorized downloads use time-limited HMAC cryptographic tokens.
- **Hashed Invitation Tokens**: Vendor invitation links use high-entropy cryptographically hashed tokens (`hashlib.sha256`), preventing token compromise even if database records leak.
- **Audit Logging**: Sensitive operations (document approvals, rejections, status changes, workflow publications) are recorded into `audit_logs`.

### 3. Comprehensive Overview Dashboard
- **Real Database-Backed Statistics**:
  - Total Vendors
  - Approved Suppliers
  - Pending Reviews
  - Incomplete Submissions
  - Documents Expiring in 30 Days
  - Expired Documents
- **Vendor Activity Directory**: Filter by onboarding status (`ALL`, `INVITED`, `IN_PROGRESS`, `SUBMITTED`, `APPROVED`, `REJECTED`, `SUSPENDED`) and category, with instant search.
- **Pending Review Queue**: Real-time review queue with 1-click inspection.
- **Upcoming Expirations Widget**: Immediate visibility into perishable certificates.

### 4. Dedicated Public Vendor Onboarding Portal
- **Unique Invitation URLs**: Generated at `/vendor/onboard/[token]`.
- **Dynamic Field & Upload Rendering**: Dynamically builds the form from the published schema.
- **File Upload Validation**: Enforces MIME types, file sizes (up to 10MB), and magic byte signatures.
- **Perishable Document Expiry Input**: Prompts vendors to supply certificate expiration dates when `track_expiry=True`.
- **Submission Confirmation**: Transitions vendor to `SUBMITTED` status and issues email confirmation.

### 5. Document Review & Approval Workflow
- **Compliance Queue**: View submitted documents with preview and download access.
- **Authenticated Server-Side Approval**: Automatically checks if all required documents are approved, transitioning the vendor to `APPROVED`.
- **Mandatory Rejection Reasons**: Rejections and resubmission requests enforce a required explanatory comment logged into `document_reviews` and dispatched to the vendor.

### 6. Document Expiry Tracker & Reminder Engine
- **5-Tier Expiry Buckets**:
  - `Already Expired` (< 0 days)
  - `Critical: Expiring Within 7 Days`
  - `Expiring Within 30 Days`
  - `Expiring Within 60 Days`
  - `Valid for Longer` (> 60 days)
- **Persistent Background Scheduler**: FastAPI lifespan scheduler scans certificate expiration milestones (30, 7, 1 day) independently of browser sessions.
- **Idempotent Delivery**: Prevents duplicate emails using unique database idempotency constraints (`expiry_{doc_id}_{days}d_{date}`).
- **Development Logger Mode**: When Resend API credentials are not configured, emails are cleanly simulated and recorded into `notification_jobs`.

---

## 🏗️ Repository Structure

```
VendorFlow/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── deps.py                  # JWT Auth & Tenant isolation dependency guards
│   │   │   └── v1/
│   │   │       ├── auth.py              # Signup, login, organization profile
│   │   │       ├── workflows.py         # AI generator, templates, versioning, invitations
│   │   │       ├── vendors.py           # Vendor directory, profiles, document requests
│   │   │       ├── documents.py         # Review queue, approvals, rejections, downloads
│   │   │       ├── dashboard.py         # Real-time metrics & expiry tracker buckets
│   │   │       └── public_onboarding.py # Public vendor portal endpoints
│   │   ├── core/
│   │   │   ├── config.py                # Pydantic v2 settings & environment variables
│   │   │   ├── database.py              # SQLAlchemy 2.0 engine & SessionLocal
│   │   │   ├── security.py              # Bcrypt hashing, JWT encode/decode, token hashing
│   │   │   ├── utils.py                 # Timezone & normalization helpers
│   │   │   └── seed.py                  # Realistic demo data populator
│   │   ├── models/
│   │   │   └── models.py                # Normalized SQLAlchemy models with foreign keys & indexes
│   │   ├── schemas/
│   │   │   ├── auth.py                  # User, Org, & Token schemas
│   │   │   ├── workflow.py              # Workflow & Field schema definitions
│   │   │   ├── vendor.py                # Vendor management & public submission schemas
│   │   │   └── document.py              # Review action, expiry bucket, & stats schemas
│   │   ├── services/
│   │   │   ├── ai_workflow_generator.py # OpenAI structured output & fallback parser
│   │   │   ├── storage_service.py       # Private file storage & signed URL generator
│   │   │   └── notification_service.py  # Transactional emails & idempotency records
│   │   ├── tasks/
│   │   │   └── expiry_scheduler.py      # Persistent background reminder scheduler
│   │   └── main.py                      # FastAPI application with CORS & lifespan scheduler
│   ├── migrations/                      # Alembic database migrations
│   ├── tests/
│   │   └── test_backend.py              # Automated Pytest suite (6/6 tests passing)
│   └── requirements.txt
├── frontend/
│   ├── app/
│   │   ├── auth/login/page.tsx          # Administrator sign in with 1-click Demo Fill
│   │   ├── auth/signup/page.tsx         # Organization setup & administrator registration
│   │   ├── documents/page.tsx           # Document review queue with inline verification
│   │   ├── expiry/page.tsx              # Expiry tracker with 5 bucket categories
│   │   ├── settings/page.tsx            # Organization profile & platform health indicators
│   │   ├── vendor/onboard/[token]/      # Public dynamic vendor onboarding portal
│   │   ├── vendors/page.tsx             # Filterable vendor directory
│   │   ├── vendors/[id]/page.tsx        # Vendor details, document checklist, audit log
│   │   ├── workflows/page.tsx           # Workflows list with version badges
│   │   ├── workflows/new/page.tsx       # AI prompt input & interactive form builder
│   │   ├── layout.tsx                   # Responsive application shell
│   │   └── page.tsx                     # Overview Dashboard with metrics & activity
│   ├── components/
│   │   ├── Sidebar.tsx                  # Persistent navigation sidebar
│   │   ├── TopNav.tsx                   # Top header navigation
│   │   ├── StatusBadge.tsx              # Colored visual status pills
│   │   ├── DocumentReviewModal.tsx      # Document review, approve, reject with reason
│   │   ├── WorkflowPreviewModal.tsx     # Manager preview of vendor form
│   │   └── InvitationModal.tsx          # Vendor invitation creator with copyable link
│   ├── lib/
│   │   ├── api.ts                       # Unified typed API client
│   │   └── types.ts                     # TypeScript interfaces
│   └── package.json
├── .env.example                         # Environment configuration template
├── docker-compose.yml                   # PostgreSQL container definition
└── README.md
```

---

## 🚀 Running the Application

### Prerequisites
- **Python**: 3.12+
- **Node.js**: v20+ / v24+
- **npm**: 10+

### 1. Backend Setup & Startup

```powershell
# In project root:
# 1. Activate virtual environment
backend\venv\Scripts\activate

# 2. (Optional) Run Alembic migrations
backend\venv\Scripts\alembic.exe upgrade head

# 3. (Optional) Populate realistic development data
python backend/app/core/seed.py

# 4. Start the FastAPI backend server (port 8000)
backend\venv\Scripts\uvicorn.exe app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload
```

The backend API will be live at:
- **API Base**: `http://127.0.0.1:8000`
- **Interactive Swagger Docs**: `http://127.0.0.1:8000/docs`

---

### 2. Frontend Setup & Startup

```powershell
# In a new terminal, navigate to frontend:
cd frontend

# Start the Next.js development server (port 3000)
npm run dev -- -p 3000
```

The frontend will be live at:
- **Dashboard / App**: `http://localhost:3000`
- **Login**: `http://localhost:3000/auth/login`

---

## 🔑 Demo Account Credentials

VendorFlow includes a pre-seeded demonstration organization ready for immediate evaluation:

| Role | Email | Password |
|---|---|---|
| **Compliance Admin** | `demo@vendorflow.io` | `Password123!` |

*(On the Login screen, click **"Auto Fill"** to populate these credentials in 1 click).*

### Demo Vendor Invitation Link:
To test the external vendor onboarding portal without creating a new invitation:
- `http://localhost:3000/vendor/onboard/demo-invitation-token-beacon-2026`

---

## 🧪 Automated Testing

### Backend Test Suite (Pytest)
Run the automated test suite covering AI schema generation, user authentication, tenant isolation, workflow publishing, document reviews, and reminder idempotency:

```powershell
backend\venv\Scripts\pytest.exe backend/tests/test_backend.py -v
```

**Results**:
```
backend/tests/test_backend.py::test_ai_workflow_parser_schema PASSED             [ 16%]
backend/tests/test_backend.py::test_user_signup_and_auth PASSED                  [ 33%]
backend/tests/test_backend.py::test_tenant_isolation PASSED                      [ 50%]
backend/tests/test_backend.py::test_workflow_lifecycle_and_invitation PASSED     [ 66%]
backend/tests/test_backend.py::test_reminder_idempotency_and_deduplication PASSED [ 83%]
backend/tests/test_backend.py::test_document_rejection_and_dashboard_stats PASSED [100%]

============================== 6 passed in 2.77s ==============================
```

### Frontend Production Build (Next.js)
```powershell
cd frontend
npm run build
```

**Results**:
```
✓ Compiled successfully
✓ Finished TypeScript in 2.1s
✓ Generating static pages (14/14) in 694ms
○ 14 static and partial prerendered routes generated with 0 errors.
```

---

## ⚙️ Environment Variables (`.env.example`)

Copy `.env.example` to `.env` to configure external third-party services:

```ini
# Environment
ENVIRONMENT=development
APP_NAME="VendorFlow"
DEBUG=true

# Database (PostgreSQL / Supabase or SQLite for zero-setup local dev)
DATABASE_URL=sqlite:///./vendorflow.db
# For PostgreSQL:
# DATABASE_URL=postgresql+psycopg2://postgres:password@localhost:5432/vendorflow

# JWT Security
SECRET_KEY=change-this-to-a-super-secret-random-32-byte-hex-string-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# OpenAI API (For AI Workflow Generation)
# If left blank, VendorFlow activates an intelligent deterministic fallback generator
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini

# Transactional Email (Resend)
# If left blank, VendorFlow logs simulated emails to console and the notification_jobs table
RESEND_API_KEY=
SENDER_EMAIL=onboarding@vendorflow.io

# Supabase (Optional)
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=vendor-documents
```

---

## 🛡️ Production Hardening & Security Notes

1. **Tenant Isolation**: Server-side checks on every route prevent cross-tenant data leakage by validating `entity.organization_id == current_org.id`.
2. **Private File Storage**: Files are stored outside public web directories with hashed filenames. Downloads must provide short-lived signed HMAC tokens.
3. **Invitation Security**: Plaintext invitation tokens are never stored in the database; only SHA-256 hashes are persisted.
4. **Idempotency**: All notification dispatches require a unique idempotency key, preventing duplicate reminder emails if the background task executes multiple times.
