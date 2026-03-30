from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite+aiosqlite:///./data/bilianalyzer.db"
    SECRET_KEY: str = ""
    CORS_ORIGINS: str = "http://localhost:5173"
    DATA_DIR: str = "./data"

    class Config:
        env_file = ".env"

settings = Settings()
