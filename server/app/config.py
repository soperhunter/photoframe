from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    photos_dir: str = "/opt/apps/photoframe/data/photos"
    db_path: str = "/opt/apps/photoframe/data/db.sqlite"
    port: int = 8002
    admin_user: str = "admin"
    admin_password: str = "changeme"
    auth_disabled: bool = False   # set AUTH_DISABLED=true in .env for dev
    google_client_id: str = ""
    google_client_secret: str = ""

    model_config = {"env_file": ".env"}


settings = Settings()
