import os
import uuid
import mimetypes
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple
from fastapi import UploadFile, HTTPException, status
from app.core.config import settings
from app.core.security import create_access_token, decode_access_token

class StorageService:
    def __init__(self):
        self.local_dir = settings.LOCAL_STORAGE_DIR
        os.makedirs(self.local_dir, exist_ok=True)
        self.supabase_enabled = bool(settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY)

    def validate_file(self, file: UploadFile, content: bytes) -> None:
        # Check size
        if len(content) > settings.MAX_FILE_SIZE_BYTES:
            max_mb = settings.MAX_FILE_SIZE_BYTES / (1024 * 1024)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File exceeds maximum allowed size of {max_mb:.0f}MB"
            )

        # Check content type
        content_type = file.content_type or mimetypes.guess_type(file.filename or "")[0] or ""
        if content_type not in settings.ALLOWED_FILE_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File type '{content_type}' is not permitted. Allowed: {', '.join(settings.ALLOWED_FILE_TYPES)}"
            )

        # Basic magic bytes check for security
        if content_type == "application/pdf" and not content.startswith(b"%PDF"):
            raise HTTPException(status_code=400, detail="Invalid PDF file signature.")
        elif content_type == "image/png" and not content.startswith(b"\x89PNG\r\n\x1a\n"):
            raise HTTPException(status_code=400, detail="Invalid PNG file signature.")
        elif content_type == "image/jpeg" and not (content.startswith(b"\xff\xd8\xff")):
            raise HTTPException(status_code=400, detail="Invalid JPEG file signature.")

    async def save_file(
        self,
        file: UploadFile,
        organization_id: str,
        vendor_id: str
    ) -> Tuple[str, int, str]:
        """
        Saves file to private storage.
        Returns: (storage_path, file_size, mime_type)
        """
        content = await file.read()
        self.validate_file(file, content)

        ext = os.path.splitext(file.filename or "")[1].lower()
        if not ext:
            if file.content_type == "application/pdf":
                ext = ".pdf"
            elif file.content_type == "image/png":
                ext = ".png"
            elif file.content_type == "image/jpeg":
                ext = ".jpg"

        # Safe unguessable storage key
        random_name = f"{uuid.uuid4().hex}{ext}"
        relative_path = os.path.join(organization_id, vendor_id, random_name).replace("\\", "/")

        if self.supabase_enabled:
            # Future Supabase Storage private bucket integration if keys provided
            pass

        # Save to local private storage
        full_dest = os.path.join(self.local_dir, relative_path)
        os.makedirs(os.path.dirname(full_dest), exist_ok=True)
        with open(full_dest, "wb") as f:
            f.write(content)

        return relative_path, len(content), file.content_type or "application/octet-stream"

    def get_file_path(self, storage_path: str) -> str:
        """Resolve full local path safely preventing path traversal."""
        full_path = os.path.abspath(os.path.join(self.local_dir, storage_path))
        if not full_path.startswith(os.path.abspath(self.local_dir)):
            raise HTTPException(status_code=403, detail="Access denied: invalid storage path")
        if not os.path.exists(full_path):
            raise HTTPException(status_code=404, detail="Document file not found in storage")
        return full_path

    def delete_file(self, storage_path: str) -> bool:
        """Safely delete file from storage if it exists."""
        try:
            full_path = self.get_file_path(storage_path)
            if os.path.exists(full_path):
                os.remove(full_path)
                return True
        except Exception:
            pass
        return False

    def generate_signed_download_url(self, document_id: str, organization_id: str, expires_in_seconds: int = 3600) -> str:
        """
        Generates a short-lived tokenized URL to download or preview private documents.
        """
        payload = {
            "sub": "doc_download",
            "doc_id": document_id,
            "org_id": organization_id,
            "exp": datetime.now(timezone.utc) + timedelta(seconds=expires_in_seconds)
        }
        token = create_access_token(subject=document_id, expires_delta=timedelta(seconds=expires_in_seconds))
        return f"/api/v1/documents/{document_id}/download?token={token}"

storage_service = StorageService()
