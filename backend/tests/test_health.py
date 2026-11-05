from fastapi.testclient import TestClient


def test_health_endpoint_returns_200(client: TestClient):
    """Verify GET /health returns HTTP 200 without requiring PostgreSQL."""
    response = client.get("/health")
    assert response.status_code == 200

    data = response.json()
    assert "status" in data
    assert data["status"] in ["ok", "ok_standalone", "degraded"]
    assert "timestamp" in data
    assert "version" in data
    assert "environment" in data
    assert "database" in data
    assert "integrations" in data

    # Verify integrations map has expected boolean flags
    integrations = data["integrations"]
    assert "sarvam_ai" in integrations
    assert "exotel_telephony" in integrations
    assert "whatsapp_messaging" in integrations
    assert "sms_gateway" in integrations
    assert "gtfs_fixtures" in integrations


def test_api_prefixed_health_returns_200(client: TestClient):
    """Verify GET /api/health also returns HTTP 200."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["version"] == "0.1.0"

