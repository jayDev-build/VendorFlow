import re
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_password_hash, verify_password, create_access_token
from app.models.models import User, Organization, AuditLog
from app.schemas.auth import (
    UserSignUp,
    UserLogin,
    Token,
    UserResponse,
    UserUpdate,
    OrganizationResponse,
    OrganizationUpdate
)
from app.api.deps import get_current_user, get_current_org

router = APIRouter(prefix="/auth", tags=["Authentication & Organization"])

def slugify(text: str) -> str:
    slug = re.sub(r"[^\w\s-]", "", text).strip().lower()
    return re.sub(r"[-\s]+", "-", slug)

@router.post("/signup", response_model=Token, status_code=status.HTTP_201_CREATED)
def signup(data: UserSignUp, db: Session = Depends(get_db)):
    # Check if user email already exists
    existing_user = db.query(User).filter(User.email == data.email.lower()).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists"
        )

    # Generate slug for organization
    base_slug = slugify(data.organization_name)
    slug = base_slug
    counter = 1
    while db.query(Organization).filter(Organization.slug == slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1

    # Atomic creation of organization and administrator
    org = Organization(
        name=data.organization_name.strip(),
        slug=slug,
        business_profile=data.business_profile or {}
    )
    db.add(org)
    db.flush()

    user = User(
        organization_id=org.id,
        email=data.email.lower().strip(),
        hashed_password=get_password_hash(data.password),
        full_name=data.full_name.strip(),
        role="admin",
        is_active=True
    )
    db.add(user)
    db.flush()

    # Audit log
    audit = AuditLog(
        organization_id=org.id,
        user_id=user.id,
        action="ORGANIZATION_AND_ADMIN_CREATED",
        entity_type="organization",
        entity_id=org.id,
        details={"org_name": org.name, "admin_email": user.email}
    )
    db.add(audit)
    db.commit()
    db.refresh(org)
    db.refresh(user)

    access_token = create_access_token(subject=user.id)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user,
        "organization": org
    }

@router.post("/login", response_model=Token)
def login(data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email.lower().strip()).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )

    org = db.query(Organization).filter(Organization.id == user.organization_id).first()
    access_token = create_access_token(subject=user.id)

    # Log login
    audit = AuditLog(
        organization_id=org.id,
        user_id=user.id,
        action="USER_LOGIN",
        entity_type="user",
        entity_id=user.id,
        details={"email": user.email}
    )
    db.add(audit)
    db.commit()

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user,
        "organization": org
    }

@router.get("/me")
def get_current_user_profile(
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_org)
):
    return {
        "user": current_user,
        "organization": current_org
    }

@router.patch("/me", response_model=UserResponse)
def update_current_user_profile(
    data: UserUpdate,
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_org),
    db: Session = Depends(get_db)
):
    updated_fields = {}
    if data.full_name is not None and data.full_name.strip() and data.full_name.strip() != current_user.full_name:
        current_user.full_name = data.full_name.strip()
        updated_fields["full_name"] = current_user.full_name

    if data.email is not None and data.email.lower().strip() != current_user.email:
        new_email = data.email.lower().strip()
        existing = db.query(User).filter(User.email == new_email, User.id != current_user.id).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This email address is already in use by another account"
            )
        current_user.email = new_email
        updated_fields["email"] = current_user.email

    if data.new_password:
        if not data.current_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is required to change your password"
            )
        if not verify_password(data.current_password, current_user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password does not match"
            )
        current_user.hashed_password = get_password_hash(data.new_password)
        updated_fields["password_changed"] = True

    if updated_fields:
        audit = AuditLog(
            organization_id=current_org.id,
            user_id=current_user.id,
            action="ADMIN_PROFILE_UPDATED",
            entity_type="user",
            entity_id=current_user.id,
            details=updated_fields
        )
        db.add(audit)
        db.commit()
        db.refresh(current_user)

    return current_user

@router.get("/organization", response_model=OrganizationResponse)
def get_organization(current_org: Organization = Depends(get_current_org)):
    return current_org

@router.patch("/organization", response_model=OrganizationResponse)
def update_organization(
    data: OrganizationUpdate,
    current_org: Organization = Depends(get_current_org),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if data.name:
        current_org.name = data.name.strip()
    if data.business_profile is not None:
        current_org.business_profile = data.business_profile
    db.commit()
    db.refresh(current_org)

    audit = AuditLog(
        organization_id=current_org.id,
        user_id=current_user.id,
        action="ORGANIZATION_UPDATED",
        entity_type="organization",
        entity_id=current_org.id,
        details={"name": current_org.name}
    )
    db.add(audit)
    db.commit()

    return current_org
