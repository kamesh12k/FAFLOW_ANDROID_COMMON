import os
import re
import hmac
import time
import uuid
import base64
import hashlib
import logging
from abc import ABC, abstractmethod
from typing import Optional, Tuple, BinaryIO
from datetime import datetime, timezone
from pathlib import Path

from fastapi import HTTPException, status
from app.config import settings

logger = logging.getLogger(__name__)

# Permitted MIME types and file extensions
ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".jfif", ".png", ".webp", ".gif", ".bmp"}
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/x-pdf",
    "image/jpeg",
    "image/jpg",
    "image/pjpeg",
    "image/jfif",
    "image/png",
    "image/x-png",
    "image/webp",
    "image/gif",
    "image/bmp",
}

# Magic bytes signatures for MIME spoofing defense
MAGIC_SIGNATURES = {
    "application/pdf": [b"%PDF-"],
    "image/jpeg": [b"\xFF\xD8"],
    "image/png": [b"\x89PNG\r\n\x1a\n"],
    "image/webp": [b"RIFF"],  # also checks WEBP at bytes 8..12
    "image/gif": [b"GIF87a", b"GIF89a"],
    "image/bmp": [b"BM"],
}


def sanitize_filename(filename: str) -> str:
    """Strips directory traversal, dangerous characters, and trims filename."""
    name = Path(filename).name
    # Strip null bytes and non-printable chars
    name = re.sub(r"[\x00-\x1f\x7f-\x9f]", "", name)
    # Allow alphanumeric, dashes, underscores, dots, and spaces
    name = re.sub(r"[^a-zA-Z0-9._\s-]", "_", name)
    # Trim excessive length
    if len(name) > 120:
        stem, ext = os.path.splitext(name)
        name = stem[:120 - len(ext)] + ext
    return name.strip() or "attachment"


def validate_file_metadata(file_name: str, file_type: str, file_size: int) -> None:
    """Validates extension, MIME type, and size constraints."""
    ext = Path(file_name).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File extension '{ext}' is not supported. Allowed extensions: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    mime = (file_type or "").lower()
    # Normalize MIME type from extension if missing or generic
    if mime in {"", "application/octet-stream", "binary/octet-stream"} or not mime.startswith(("image/", "application/")):
        if ext in {".jpg", ".jpeg", ".jfif"}:
            mime = "image/jpeg"
        elif ext == ".png":
            mime = "image/png"
        elif ext == ".pdf":
            mime = "application/pdf"
        elif ext == ".webp":
            mime = "image/webp"
        elif ext == ".gif":
            mime = "image/gif"
        elif ext == ".bmp":
            mime = "image/bmp"

    if mime not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File MIME type '{file_type}' is not supported. Allowed types: PDF, JPEG, PNG, WEBP, GIF.",
        )

    max_bytes = settings.ANNOUNCEMENT_MAX_ATTACHMENT_SIZE_MB * 1024 * 1024
    if file_size > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File exceeds maximum allowed size of {settings.ANNOUNCEMENT_MAX_ATTACHMENT_SIZE_MB} MB.",
        )
    if file_size <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size must be greater than zero bytes.",
        )


def validate_file_magic_bytes(header: bytes, declared_type: str) -> bool:
    """Inspects header bytes to confirm actual file format matches declared type or is a safe image."""
    declared = (declared_type or "").lower()
    if declared in {"application/pdf", "application/x-pdf"}:
        return header.startswith(b"%PDF-")

    # If declared is any image type, verify that actual content is indeed a legitimate image
    if declared.startswith("image/"):
        is_actual_jpeg = header.startswith(b"\xFF\xD8")
        is_actual_png = header.startswith(b"\x89PNG\r\n\x1a\n")
        is_actual_webp = header.startswith(b"RIFF") and len(header) >= 12 and header[8:12] == b"WEBP"
        is_actual_gif = header.startswith(b"GIF87a") or header.startswith(b"GIF89a")
        is_actual_bmp = header.startswith(b"BM")
        return is_actual_jpeg or is_actual_png or is_actual_webp or is_actual_gif or is_actual_bmp

    return False


def generate_storage_key(tenant_id: str, announcement_id: int | str, file_name: str) -> str:
    """Generates a predictable, tenant-isolated, collision-free storage key.
    Pattern: tenant/{tenant_id}/announcements/{YYYY}/{MM}/{announcement_id}/{uuid}_{safe_filename}
    """
    now = datetime.now(timezone.utc)
    safe_name = sanitize_filename(file_name)
    unique_prefix = uuid.uuid4().hex[:12]
    return f"tenant/{tenant_id}/announcements/{now.year}/{now.month:02d}/{announcement_id}/{unique_prefix}_{safe_name}"


class StorageBackend(ABC):
    @abstractmethod
    def generate_presigned_upload(self, storage_key: str, file_name: str, file_type: str, file_size: int, expires_in: int) -> dict:
        pass

    @abstractmethod
    def generate_presigned_download(self, storage_key: str, file_name: str, expires_in: int) -> str:
        pass

    @abstractmethod
    def save_file_stream(self, storage_key: str, stream: BinaryIO, expected_size: int, declared_type: str) -> Tuple[int, str]:
        """Saves stream directly to storage, validating magic bytes, and returns (saved_bytes, sha256_hex)."""
        pass

    @abstractmethod
    def get_file_path_or_stream(self, storage_key: str) -> Tuple[Optional[str], Optional[BinaryIO], int]:
        """Returns (file_path, None, size) or (None, stream, size)."""
        pass

    @abstractmethod
    def delete_file(self, storage_key: str) -> bool:
        pass

    @abstractmethod
    def file_exists(self, storage_key: str) -> bool:
        pass


class LocalStorageBackend(StorageBackend):
    """Local filesystem storage backend with HMAC-signed tokenized URLs.
    Eliminates external cloud dependencies for local dev and on-prem deployments."""

    def __init__(self, base_path: str):
        self.base_path = Path(base_path).resolve()
        self.base_path.mkdir(parents=True, exist_ok=True)

    def _resolve_path(self, storage_key: str) -> Path:
        # Prevent directory traversal
        normalized = Path(storage_key).as_posix().lstrip("/")
        full_path = (self.base_path / normalized).resolve()
        if not str(full_path).startswith(str(self.base_path)):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid storage path detected.")
        return full_path

    def _sign_token(self, payload: str) -> str:
        sig = hmac.new(settings.SECRET_KEY.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()
        raw = f"{payload}|{sig}"
        return base64.urlsafe_b64encode(raw.encode("utf-8")).decode("utf-8")

    def verify_token(self, token: str) -> dict:
        try:
            raw = base64.urlsafe_b64decode(token.encode("utf-8")).decode("utf-8")
            parts = raw.split("|")
            if len(parts) != 2:
                raise ValueError("Malformed token")
            payload, sig = parts
            expected_sig = hmac.new(settings.SECRET_KEY.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()
            if not hmac.compare_digest(sig, expected_sig):
                raise ValueError("Signature mismatch")
            
            # Payload format: key:storage_key;name:file_name;type:file_type;size:file_size;exp:exp_timestamp
            items = dict(item.split("=", 1) for item in payload.split(";") if "=" in item)
            exp = int(items.get("exp", 0))
            if time.time() > exp:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Storage link has expired.")
            return items
        except HTTPException:
            raise
        except Exception as e:
            logger.warning("Storage token verification failed: %s", e)
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid or tampered storage token.")

    def generate_presigned_upload(self, storage_key: str, file_name: str, file_type: str, file_size: int, expires_in: int) -> dict:
        exp = int(time.time()) + expires_in
        payload = f"key={storage_key};name={sanitize_filename(file_name)};type={file_type};size={file_size};exp={exp}"
        token = self._sign_token(payload)
        upload_url = f"/api/announcements/attachments/upload-stream?token={token}"
        return {
            "upload_url": upload_url,
            "storage_key": storage_key,
            "file_name": file_name,
            "file_type": file_type,
            "file_size": file_size,
            "signed_token": token,
            "expires_in": expires_in,
        }

    def generate_presigned_download(self, storage_key: str, file_name: str, expires_in: int) -> str:
        exp = int(time.time()) + expires_in
        payload = f"key={storage_key};name={sanitize_filename(file_name)};exp={exp}"
        token = self._sign_token(payload)
        return f"/api/announcements/attachments/file?token={token}"

    def save_file_stream(self, storage_key: str, stream: BinaryIO, expected_size: int, declared_type: str) -> Tuple[int, str]:
        target_path = self._resolve_path(storage_key)
        target_path.parent.mkdir(parents=True, exist_ok=True)

        sha256 = hashlib.sha256()
        bytes_written = 0
        header_checked = False
        chunk_size = 64 * 1024  # 64 KB chunks

        with open(target_path, "wb") as f_out:
            while True:
                chunk = stream.read(chunk_size)
                if not chunk:
                    break
                if not header_checked:
                    # Validate magic bytes on first chunk
                    if not validate_file_magic_bytes(chunk, declared_type):
                        f_out.close()
                        target_path.unlink(missing_ok=True)
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="File content does not match the declared MIME type. Upload rejected.",
                        )
                    header_checked = True

                f_out.write(chunk)
                sha256.update(chunk)
                bytes_written += len(chunk)

                # Guard against oversized streams
                if bytes_written > settings.ANNOUNCEMENT_MAX_ATTACHMENT_SIZE_MB * 1024 * 1024:
                    f_out.close()
                    target_path.unlink(missing_ok=True)
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"File exceeds maximum allowed size of {settings.ANNOUNCEMENT_MAX_ATTACHMENT_SIZE_MB} MB.",
                    )

        return bytes_written, sha256.hexdigest()

    def get_file_path_or_stream(self, storage_key: str) -> Tuple[Optional[str], Optional[BinaryIO], int]:
        target_path = self._resolve_path(storage_key)
        if not target_path.is_file():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment file not found on storage.")
        return str(target_path), None, target_path.stat().st_size

    def delete_file(self, storage_key: str) -> bool:
        try:
            target_path = self._resolve_path(storage_key)
            if target_path.is_file():
                target_path.unlink()
                return True
            return False
        except Exception as e:
            logger.error("Failed to delete file at %s: %s", storage_key, e)
            return False

    def file_exists(self, storage_key: str) -> bool:
        target_path = self._resolve_path(storage_key)
        return target_path.is_file()


class S3StorageBackend(StorageBackend):
    """S3 / MinIO / Cloudflare R2 / GCS storage backend."""

    def __init__(self):
        try:
            import boto3
            from botocore.client import Config
        except ImportError:
            raise RuntimeError("boto3 is required for S3StorageBackend. Run `pip install boto3` or use STORAGE_BACKEND=local.")

        s3_kwargs = {
            "region_name": settings.STORAGE_S3_REGION,
            "aws_access_key_id": settings.STORAGE_S3_ACCESS_KEY,
            "aws_secret_access_key": settings.STORAGE_S3_SECRET_KEY,
            "config": Config(signature_version="s3v4"),
        }
        if settings.STORAGE_S3_ENDPOINT_URL:
            s3_kwargs["endpoint_url"] = settings.STORAGE_S3_ENDPOINT_URL

        self.s3 = boto3.client("s3", **s3_kwargs)
        self.bucket = settings.STORAGE_S3_BUCKET

    def generate_presigned_upload(self, storage_key: str, file_name: str, file_type: str, file_size: int, expires_in: int) -> dict:
        url = self.s3.generate_presigned_url(
            ClientMethod="put_object",
            Params={
                "Bucket": self.bucket,
                "Key": storage_key,
                "ContentType": file_type,
            },
            ExpiresIn=expires_in,
        )
        return {
            "upload_url": url,
            "storage_key": storage_key,
            "file_name": file_name,
            "file_type": file_type,
            "file_size": file_size,
            "expires_in": expires_in,
        }

    def generate_presigned_download(self, storage_key: str, file_name: str, expires_in: int) -> str:
        return self.s3.generate_presigned_url(
            ClientMethod="get_object",
            Params={
                "Bucket": self.bucket,
                "Key": storage_key,
                "ResponseContentDisposition": f'inline; filename="{sanitize_filename(file_name)}"',
            },
            ExpiresIn=expires_in,
        )

    def save_file_stream(self, storage_key: str, stream: BinaryIO, expected_size: int, declared_type: str) -> Tuple[int, str]:
        # For direct server upload fallback in S3
        header = stream.read(16)
        if not validate_file_magic_bytes(header, declared_type):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File content does not match declared MIME type.")
        stream.seek(0)
        content = stream.read()
        sha256 = hashlib.sha256(content).hexdigest()
        self.s3.put_object(
            Bucket=self.bucket,
            Key=storage_key,
            Body=content,
            ContentType=declared_type,
        )
        return len(content), sha256

    def get_file_path_or_stream(self, storage_key: str) -> Tuple[Optional[str], Optional[BinaryIO], int]:
        obj = self.s3.get_object(Bucket=self.bucket, Key=storage_key)
        return None, obj["Body"], obj["ContentLength"]

    def delete_file(self, storage_key: str) -> bool:
        try:
            self.s3.delete_object(Bucket=self.bucket, Key=storage_key)
            return True
        except Exception as e:
            logger.error("Failed to delete S3 object %s: %s", storage_key, e)
            return False

    def file_exists(self, storage_key: str) -> bool:
        try:
            self.s3.head_object(Bucket=self.bucket, Key=storage_key)
            return True
        except Exception:
            return False


def get_storage_service() -> StorageBackend:
    """Factory returning configured storage backend."""
    if settings.STORAGE_BACKEND.lower() == "s3" and settings.STORAGE_S3_BUCKET:
        return S3StorageBackend()
    return LocalStorageBackend(base_path=settings.STORAGE_LOCAL_PATH)


storage_service = get_storage_service()
