from datetime import datetime, timezone

def ensure_utc(dt: datetime) -> datetime:
    """Normalize any naive datetime to UTC aware datetime."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)
