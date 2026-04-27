import secrets
from fastapi import HTTPException, Security
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from .config import settings

security = HTTPBasic()


def require_auth(credentials: HTTPBasicCredentials = Security(security)) -> HTTPBasicCredentials:
    ok = (
        secrets.compare_digest(credentials.username.encode(), settings.admin_user.encode())
        and secrets.compare_digest(credentials.password.encode(), settings.admin_password.encode())
    )
    if not ok:
        raise HTTPException(
            status_code=401,
            detail="Unauthorized",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials
