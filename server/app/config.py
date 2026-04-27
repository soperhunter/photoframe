from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    photos_dir: str = "/opt/apps/photoframe/data/photos"
    port: int = 8002

    model_config = {"env_file": ".env"}


settings = Settings()
