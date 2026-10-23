from typing import Optional, Dict, Any
from pydantic import BaseModel, EmailStr, Field

class UserSignUp(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: str = Field(..., min_length=2)
    organization_name: str = Field(..., min_length=2)
    business_profile: Optional[Dict[str, Any]] = Field(default_factory=dict)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    business_profile: Optional[Dict[str, Any]] = None

class OrganizationResponse(BaseModel):
    id: str
    name: str
    slug: str
    business_profile: Optional[Dict[str, Any]] = None
    created_at: Any

class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    is_active: bool
    organization_id: str
    created_at: Any

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
    organization: OrganizationResponse
