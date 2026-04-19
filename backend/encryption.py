"""
NutriOS Encryption Utilities
- AES-256 field-level encryption for PII (email, name)
- SHA-256 hashing for session tokens
"""
import os
import hashlib
import base64
from cryptography.fernet import Fernet
from dotenv import load_dotenv

load_dotenv()

# ── Encryption Key ──────────────────────────────
# Generate a persistent key if not set. In production, set ENCRYPTION_KEY env var.
_env_key = os.getenv("ENCRYPTION_KEY")
if _env_key:
    FERNET_KEY = _env_key.encode() if isinstance(_env_key, str) else _env_key
else:
    # Auto-generate and persist to .env for consistency across restarts
    FERNET_KEY = Fernet.generate_key()
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    try:
        with open(env_path, "a") as f:
            f.write(f"\nENCRYPTION_KEY={FERNET_KEY.decode()}\n")
    except Exception:
        pass  # Read-only filesystem fallback

_fernet = Fernet(FERNET_KEY)


# ── Field Encryption (AES-256 via Fernet) ──────
def encrypt_field(plaintext: str) -> str:
    """Encrypt a string field. Returns base64-encoded ciphertext."""
    if not plaintext:
        return plaintext
    return _fernet.encrypt(plaintext.encode()).decode()


def decrypt_field(ciphertext: str) -> str:
    """Decrypt a previously encrypted field. Returns plaintext."""
    if not ciphertext:
        return ciphertext
    try:
        return _fernet.decrypt(ciphertext.encode()).decode()
    except Exception:
        # Field might not be encrypted yet (migration in progress)
        return ciphertext


def is_encrypted(value: str) -> bool:
    """Check if a value looks like a Fernet-encrypted token."""
    if not value:
        return False
    try:
        # Fernet tokens are base64url and start with 'gAAAAA'
        return value.startswith("gAAAAA") and len(value) > 50
    except Exception:
        return False


# ── Session Token Hashing (SHA-256) ─────────────
def hash_token(token: str) -> str:
    """One-way SHA-256 hash for session tokens."""
    return hashlib.sha256(token.encode()).hexdigest()


# ── Encrypt User Document (for writes) ──────────
def encrypt_user_pii(user_doc: dict) -> dict:
    """Encrypt PII fields before writing to DB."""
    doc = user_doc.copy()
    for field in ("email", "name"):
        if field in doc and doc[field] and not is_encrypted(doc[field]):
            doc[field] = encrypt_field(doc[field])
    return doc


# ── Decrypt User Document (for reads) ───────────
def decrypt_user_pii(user_doc: dict) -> dict:
    """Decrypt PII fields after reading from DB."""
    if not user_doc:
        return user_doc
    doc = user_doc.copy()
    for field in ("email", "name"):
        if field in doc and doc[field]:
            doc[field] = decrypt_field(doc[field])
    return doc
