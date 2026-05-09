import bcrypt
from datetime import datetime, timedelta
from typing import Optional
from jose import jwt
import os

# --- Configurations ---
SECRET_KEY = os.getenv("SECRET_KEY", "your-faisalabad-secret-key-2026")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 43200 

class Security:
    @staticmethod
    def hash_password(password: str) -> str:
        """Hashes a password using direct bcrypt implementation."""
        # Convert string to bytes
        byte_pwd = password.encode('utf-8')
        # Truncate to 72 bytes manually to be safe with bcrypt limits
        truncated_pwd = byte_pwd[:72]
        # Generate salt and hash
        salt = bcrypt.gensalt()
        hashed_pwd = bcrypt.hashpw(truncated_pwd, salt)
        # Return as string for database storage
        return hashed_pwd.decode('utf-8')

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """Verifies a password against a hashed version."""
        try:
            byte_pwd = plain_password.encode('utf-8')
            byte_hashed = hashed_password.encode('utf-8')
            return bcrypt.checkpw(byte_pwd[:72], byte_hashed)
        except Exception:
            return False

    @staticmethod
    def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
        """Generates a JWT token for the session."""
        to_encode = data.copy()
        expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
        to_encode.update({"exp": expire})
        return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)