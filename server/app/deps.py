import secrets
from typing import Optional
from fastapi import HTTPException, Security
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from .config import settings

# auto_error=False so missing credentials don't auto-reject — lets us
# bypass auth in dev without changing every endpoint signature.
security = HTTPBasic(auto_error=False)


def require_auth(
    credentials: Optional[HTTPBasicCredentials] = Security(security),
) -> Optional[HTTPBasicCredentials]:
    # TODO: re-enable before gifting — set AUTH_DISABLED=false in .env
    if settings.auth_disabled:
        return credentials

    if credentials is None:
        raise HTTPException(
            status_code=401,
            detail="Unauthorized",
            headers={"WWW-Authenticate": "Basic"},
        )
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
