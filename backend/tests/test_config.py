from backend.app.config import get_settings


def test_settings_load_defaults():
    settings = get_settings()
    assert settings.PROJECT_NAME == "Chennai Mobility AI"
    assert settings.API_V1_PREFIX == "/api"
    assert "ta" in settings.SUPPORTED_LANGUAGES
    assert "en" in settings.SUPPORTED_LANGUAGES
    assert len(settings.CORS_ORIGINS) >= 2


def test_sync_database_url_property():
    settings = get_settings()
    url = settings.sync_database_url
    assert url is None or "postgresql://" in url or "sqlite" in url
