import pytest
import importlib
from unittest.mock import patch
from cryptography.fernet import Fernet


@pytest.fixture(autouse=True)
def reset_fernet_instance(tmp_path):
    """Reset the global _fernet_instance and redirect DATA_DIR to a temp dir
    before each test so tests are fully isolated."""
    import app.core.security as sec_module

    # Reset global cache
    sec_module._fernet_instance = None

    # Patch settings to use a fresh temp DATA_DIR and no SECRET_KEY
    with patch.object(sec_module.settings, "SECRET_KEY", ""), \
         patch.object(sec_module.settings, "DATA_DIR", str(tmp_path)):
        yield

    # Ensure cache is cleared after the test too
    sec_module._fernet_instance = None


def get_fernet_fresh(tmp_path):
    """Helper that returns a Fernet built from a freshly generated key."""
    return Fernet(Fernet.generate_key())


from app.core.security import encrypt_value, decrypt_value, get_fernet


def test_encrypt_decrypt_roundtrip():
    fernet = get_fernet()
    original = "test_api_key_12345"
    encrypted = encrypt_value(original, fernet)
    assert encrypted != original
    decrypted = decrypt_value(encrypted, fernet)
    assert decrypted == original


def test_encrypt_produces_different_output():
    fernet = get_fernet()
    val = "same_value"
    e1 = encrypt_value(val, fernet)
    e2 = encrypt_value(val, fernet)
    # Fernet includes a timestamp + random IV, so outputs differ each call
    assert e1 != e2


def test_decrypt_invalid_token():
    fernet = get_fernet()
    with pytest.raises(Exception):
        decrypt_value("not-a-valid-token", fernet)


def test_secret_key_file_created(tmp_path):
    """get_fernet() should auto-create a .secret_key file when none exists."""
    import app.core.security as sec_module

    key_path = tmp_path / ".secret_key"
    assert not key_path.exists()

    get_fernet()

    assert key_path.exists()
    key_content = key_path.read_text().strip()
    # Must be a valid Fernet key (URL-safe base64, 44 chars)
    assert len(key_content) == 44


def test_secret_key_file_reused(tmp_path):
    """get_fernet() should reuse an existing .secret_key file."""
    import app.core.security as sec_module

    # Pre-write a known key
    known_key = Fernet.generate_key().decode()
    key_path = tmp_path / ".secret_key"
    key_path.write_text(known_key)

    f = get_fernet()

    # Encrypt with the returned instance and decrypt with the known key directly
    msg = "hello"
    token = f.encrypt(msg.encode())
    assert Fernet(known_key.encode()).decrypt(token).decode() == msg


def test_env_secret_key_used():
    """get_fernet() should use settings.SECRET_KEY when it is set."""
    import app.core.security as sec_module

    known_key = Fernet.generate_key().decode()
    # Override the already-patched empty SECRET_KEY with a real one
    with patch.object(sec_module.settings, "SECRET_KEY", known_key):
        f = get_fernet()

    msg = "env_key_test"
    token = f.encrypt(msg.encode())
    assert Fernet(known_key.encode()).decrypt(token).decode() == msg
