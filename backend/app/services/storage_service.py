import os
import uuid
import mimetypes
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple
from fastapi import UploadFile, HTTPException, status
from fastapi.responses import FileResponse, RedirectResponse, Response
import httpx
from app.core.config import settings
from app.core.security import create_access_token, decode_access_token

logger = logging.getLogger("formgate.storage")

class StorageService:
    def __init__(self):
        self.local_dir = settings.LOCAL_STORAGE_DIR
        os.makedirs(self.local_dir, exist_ok=True)
        self._r2_client = None

    @property
    def r2_account_id(self) -> str:
        return (settings.CLOUDFLARE_R2_ACCOUNT_ID or settings.R2_ACCOUNT_ID or os.environ.get("CLOUDFLARE_R2_ACCOUNT_ID") or os.environ.get("R2_ACCOUNT_ID") or "").strip()

    @property
    def r2_access_key(self) -> str:
        return (settings.CLOUDFLARE_R2_ACCESS_KEY_ID or settings.R2_ACCESS_KEY_ID or os.environ.get("CLOUDFLARE_R2_ACCESS_KEY_ID") or os.environ.get("R2_ACCESS_KEY_ID") or "").strip()

    @property
    def r2_secret_key(self) -> str:
        return (settings.CLOUDFLARE_R2_SECRET_ACCESS_KEY or settings.R2_SECRET_ACCESS_KEY or os.environ.get("CLOUDFLARE_R2_SECRET_ACCESS_KEY") or os.environ.get("R2_SECRET_ACCESS_KEY") or "").strip()

    @property
    def r2_bucket(self) -> str:
        return (settings.CLOUDFLARE_R2_BUCKET_NAME or settings.R2_BUCKET_NAME or os.environ.get("CLOUDFLARE_R2_BUCKET_NAME") or os.environ.get("R2_BUCKET_NAME") or "vendor-documents").strip()

    @property
    def r2_public_url(self) -> str:
        url = (settings.CLOUDFLARE_R2_PUBLIC_URL or settings.R2_PUBLIC_URL or os.environ.get("CLOUDFLARE_R2_PUBLIC_URL") or os.environ.get("R2_PUBLIC_URL") or "").strip()
        return url.rstrip("/") if url else ""

    @property
    def supabase_url(self) -> str:
        url = (settings.SUPABASE_URL or os.environ.get("SUPABASE_URL") or "").strip()
        return url.rstrip("/") if url else ""

    @property
    def supabase_service_key(self) -> str:
        return (
            settings.SUPABASE_SECRET_KEY
            or settings.SUPABASE_SERVICE_ROLE_KEY
            or settings.SUPABASE_PUBLISHABLE_KEY
            or settings.SUPABASE_ANON_KEY
            or os.environ.get("SUPABASE_SECRET_KEY")
            or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
            or os.environ.get("SUPABASE_PUBLISHABLE_KEY")
            or os.environ.get("SUPABASE_ANON_KEY")
            or ""
        ).strip()

    @property
    def supabase_bucket(self) -> str:
        return (settings.SUPABASE_STORAGE_BUCKET or os.environ.get("SUPABASE_STORAGE_BUCKET") or "forms-documents").strip()

    @property
    def has_cloudflare_r2(self) -> bool:
        return bool(self.r2_account_id and self.r2_access_key and self.r2_secret_key and self.r2_bucket)

    @property
    def has_supabase(self) -> bool:
        return bool(self.supabase_url and self.supabase_service_key and self.supabase_bucket)

    @property
    def provider(self) -> str:
        """Determines the active storage provider based on configuration & environment variables."""
        prov = (settings.STORAGE_PROVIDER or "auto").lower().strip()
        if prov in ("cloudflare", "cloudflare_r2", "r2"):
            return "cloudflare_r2"
        elif prov == "supabase":
            return "supabase"
        elif prov == "local":
            return "local"

        # 'auto' provider detection priority:
        if self.has_cloudflare_r2:
            return "cloudflare_r2"
        elif self.has_supabase:
            return "supabase"
        return "local"

    def _get_r2_client(self):
        """Initializes and returns cached boto3 S3 client for Cloudflare R2."""
        if self._r2_client is not None:
            return self._r2_client

        try:
            import boto3
            from botocore.config import Config

            endpoint = f"https://{self.r2_account_id}.r2.cloudflarestorage.com"
            client = boto3.client(
                "s3",
                endpoint_url=endpoint,
                aws_access_key_id=self.r2_access_key,
                aws_secret_access_key=self.r2_secret_key,
                region_name="auto",
                config=Config(signature_version="s3v4")
            )
            self._r2_client = client
            return client
        except ImportError:
            raise HTTPException(
                status_code=500,
                detail="boto3 library is required for Cloudflare R2 storage. Run 'pip install boto3' to enable."
            )
        except Exception as e:
            logger.error(f"Failed to initialize Cloudflare R2 client: {e}")
            raise HTTPException(status_code=500, detail=f"Cloudflare R2 connection failed: {str(e)}")

    def validate_file(self, file: UploadFile, content: bytes) -> None:
        """Validates file size, content types, and magic byte signatures."""
        if len(content) > settings.MAX_FILE_SIZE_BYTES:
            max_mb = settings.MAX_FILE_SIZE_BYTES / (1024 * 1024)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File exceeds maximum allowed size of {max_mb:.0f}MB"
            )

        content_type = file.content_type or mimetypes.guess_type(file.filename or "")[0] or ""
        if content_type not in settings.ALLOWED_FILE_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File type '{content_type}' is not permitted. Allowed: {', '.join(settings.ALLOWED_FILE_TYPES)}"
            )

        # Signature verification
        if content_type == "application/pdf" and not content.startswith(b"%PDF"):
            raise HTTPException(status_code=400, detail="Invalid PDF file signature.")
        elif content_type == "image/png" and not content.startswith(b"\x89PNG\r\n\x1a\n"):
            raise HTTPException(status_code=400, detail="Invalid PNG file signature.")
        elif content_type == "image/jpeg" and not content.startswith(b"\xff\xd8\xff"):
            raise HTTPException(status_code=400, detail="Invalid JPEG file signature.")

    async def save_file(
        self,
        file: UploadFile,
        organization_id: str,
        vendor_id: str
    ) -> Tuple[str, int, str]:
        """
        Saves file to active storage backend (Cloudflare R2, Supabase Storage, or Local).
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

        # Safe unguessable relative storage key
        random_name = f"{uuid.uuid4().hex}{ext}"
        relative_path = f"{organization_id}/{vendor_id}/{random_name}".replace("\\", "/")
        mime_type = file.content_type or "application/octet-stream"

        active_provider = self.provider

        if active_provider == "cloudflare_r2":
            try:
                client = self._get_r2_client()
                client.put_object(
                    Bucket=self.r2_bucket,
                    Key=relative_path,
                    Body=content,
                    ContentType=mime_type,
                )
                logger.info(f"Saved document to Cloudflare R2: {self.r2_bucket}/{relative_path}")
                return relative_path, len(content), mime_type
            except Exception as e:
                logger.error(f"Failed to save document to Cloudflare R2: {e}")
                raise HTTPException(status_code=500, detail=f"Failed to upload document to Cloudflare R2: {str(e)}")

        elif active_provider == "supabase":
            try:
                url = f"{self.supabase_url}/storage/v1/object/{self.supabase_bucket}/{relative_path}"
                headers = {
                    "Authorization": f"Bearer {self.supabase_service_key}",
                    "apikey": self.supabase_service_key,
                    "Content-Type": mime_type,
                    "x-upsert": "true"
                }
                with httpx.Client(timeout=30.0) as client:
                    resp = client.post(url, headers=headers, content=content)
                    if resp.status_code not in (200, 201):
                        logger.error(f"Supabase Storage error: {resp.status_code} - {resp.text}")
                        raise HTTPException(status_code=500, detail=f"Supabase Storage upload failed: {resp.text}")

                logger.info(f"Saved document to Supabase Storage: {self.supabase_bucket}/{relative_path}")
                return relative_path, len(content), mime_type
            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"Failed to upload document to Supabase Storage: {e}")
                raise HTTPException(status_code=500, detail=f"Supabase upload error: {str(e)}")

        else:
            # Local Storage
            full_dest = os.path.join(self.local_dir, relative_path)
            os.makedirs(os.path.dirname(full_dest), exist_ok=True)
            with open(full_dest, "wb") as f:
                f.write(content)
            logger.info(f"Saved document to local storage: {full_dest}")
            return relative_path, len(content), mime_type

    def get_download_response(
        self,
        storage_path: str,
        original_filename: Optional[str] = None,
        mime_type: Optional[str] = None,
        inline: bool = True,
        expires_in_seconds: int = 3600
    ) -> Response:
        """
        Returns an appropriate FastAPI response for downloading/viewing the document.
        - Cloudflare R2: Generates a presigned GET URL and returns HTTP 307 Redirect.
        - Supabase Storage: Generates a signed URL and returns HTTP 307 Redirect.
        - Local: Returns FileResponse.
        """
        active_provider = self.provider

        if active_provider == "cloudflare_r2":
            try:
                client = self._get_r2_client()
                params = {
                    "Bucket": self.r2_bucket,
                    "Key": storage_path,
                }
                if original_filename:
                    disposition = "inline" if inline else "attachment"
                    params["ResponseContentDisposition"] = f'{disposition}; filename="{original_filename}"'
                if mime_type:
                    params["ResponseContentType"] = mime_type

                presigned_url = client.generate_presigned_url(
                    "get_object",
                    Params=params,
                    ExpiresIn=expires_in_seconds
                )
                return RedirectResponse(url=presigned_url, status_code=status.HTTP_307_TEMPORARY_REDIRECT)
            except Exception as e:
                logger.error(f"Failed generating Cloudflare R2 presigned URL: {e}")
                raise HTTPException(status_code=500, detail=f"Could not generate document link: {str(e)}")

        elif active_provider == "supabase":
            try:
                sign_url = f"{self.supabase_url}/storage/v1/object/sign/{self.supabase_bucket}/{storage_path}"
                headers = {
                    "Authorization": f"Bearer {self.supabase_service_key}",
                    "apikey": self.supabase_service_key,
                    "Content-Type": "application/json"
                }
                body = {"expiresIn": expires_in_seconds}
                if not inline and original_filename:
                    body["download"] = original_filename

                with httpx.Client(timeout=15.0) as client:
                    resp = client.post(sign_url, headers=headers, json=body)
                    if resp.status_code == 200:
                        data = resp.json()
                        signed_rel = data.get("signedURL", "")
                        if signed_rel.startswith("http"):
                            full_url = signed_rel
                        else:
                            full_url = f"{self.supabase_url}/storage/v1{signed_rel}"
                        return RedirectResponse(url=full_url, status_code=status.HTTP_307_TEMPORARY_REDIRECT)
                    else:
                        logger.error(f"Supabase signed URL error: {resp.status_code} - {resp.text}")
                        raise HTTPException(status_code=500, detail="Could not generate Supabase download link")
            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"Failed to generate Supabase signed URL: {e}")
                raise HTTPException(status_code=500, detail=f"Supabase signing error: {str(e)}")

        else:
            # Local file response
            full_path = self.get_file_path(storage_path)
            media = mime_type or "application/octet-stream"
            disposition = "inline" if inline else "attachment"
            return FileResponse(
                path=full_path,
                media_type=media,
                filename=original_filename if not inline else None,
                content_disposition_type=disposition
            )

    def get_file_path(self, storage_path: str) -> str:
        """Resolve full local path safely preventing path traversal."""
        full_path = os.path.abspath(os.path.join(self.local_dir, storage_path))
        if not full_path.startswith(os.path.abspath(self.local_dir)):
            raise HTTPException(status_code=403, detail="Access denied: invalid storage path")
        if not os.path.exists(full_path):
            raise HTTPException(status_code=404, detail="Document file not found in local storage")
        return full_path

    def get_file_bytes(self, storage_path: str) -> Tuple[bytes, str]:
        """Reads and returns (bytes, content_type) from active storage provider."""
        active_provider = self.provider

        if active_provider == "cloudflare_r2":
            client = self._get_r2_client()
            resp = client.get_object(Bucket=self.r2_bucket, Key=storage_path)
            data = resp["Body"].read()
            ct = resp.get("ContentType", "application/octet-stream")
            return data, ct

        elif active_provider == "supabase":
            url = f"{self.supabase_url}/storage/v1/object/authenticated/{self.supabase_bucket}/{storage_path}"
            headers = {
                "Authorization": f"Bearer {self.supabase_service_key}",
                "apikey": self.supabase_service_key
            }
            with httpx.Client(timeout=30.0) as client:
                res = client.get(url, headers=headers)
                if res.status_code == 200:
                    return res.content, res.headers.get("Content-Type", "application/octet-stream")
                raise HTTPException(status_code=404, detail="Document not found in Supabase Storage")

        else:
            full_path = self.get_file_path(storage_path)
            with open(full_path, "rb") as f:
                data = f.read()
            ct = mimetypes.guess_type(full_path)[0] or "application/octet-stream"
            return data, ct

    def delete_file(self, storage_path: str) -> bool:
        """Safely delete file from active storage provider."""
        active_provider = self.provider
        try:
            if active_provider == "cloudflare_r2":
                client = self._get_r2_client()
                client.delete_object(Bucket=self.r2_bucket, Key=storage_path)
                return True
            elif active_provider == "supabase":
                url = f"{self.supabase_url}/storage/v1/object/{self.supabase_bucket}"
                headers = {
                    "Authorization": f"Bearer {self.supabase_service_key}",
                    "apikey": self.supabase_service_key,
                    "Content-Type": "application/json"
                }
                with httpx.Client(timeout=10.0) as client:
                    client.request("DELETE", url, headers=headers, json={"prefixes": [storage_path]})
                return True
            else:
                full_path = self.get_file_path(storage_path)
                if os.path.exists(full_path):
                    os.remove(full_path)
                    return True
        except Exception as e:
            logger.warning(f"Could not delete storage file '{storage_path}': {e}")
        return False

    def generate_signed_download_url(self, document_id: str, organization_id: str, expires_in_seconds: int = 3600) -> str:
        """
        Generates a short-lived tokenized URL to download or preview private documents.
        Validates permission on the backend and redirects or streams from active storage.
        """
        token = create_access_token(subject=document_id, expires_delta=timedelta(seconds=expires_in_seconds))
        return f"/api/v1/documents/{document_id}/download?token={token}"

storage_service = StorageService()
