import os
from pathlib import Path
from cryptography.fernet import Fernet
from app.core.config import settings

_fernet_instance: Fernet | None = None


def get_fernet() -> Fernet:
    global _fernet_instance
    if _fernet_instance is not None:
        return _fernet_instance

    key = settings.SECRET_KEY
    if not key:
        key_path = Path(settings.DATA_DIR) / ".secret_key"
        if key_path.exists():
            key = key_path.read_text().strip()
        else:
            key = Fernet.generate_key().decode()
            key_path.parent.mkdir(parents=True, exist_ok=True)
            key_path.write_text(key)

    _fernet_instance = Fernet(key.encode() if isinstance(key, str) else key)
    return _fernet_instance


def encrypt_value(value: str, fernet: Fernet | None = None) -> str:
    f = fernet or get_fernet()
    return f.encrypt(value.encode()).decode()


def decrypt_value(token: str, fernet: Fernet | None = None) -> str:
    f = fernet or get_fernet()
    return f.decrypt(token.encode()).decode()
