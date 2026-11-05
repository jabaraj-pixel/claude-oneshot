from fastapi.testclient import TestClient


def test_404_error_structure(client: TestClient):
    """Verify 404 responses conform to StandardErrorResponse."""
    response = client.get("/non-existent-endpoint")
    assert response.status_code == 404
    data = response.json()
    assert "error" in data
    assert data["error"]["code"] == "NOT_FOUND"
    assert "timestamp" in data
    assert "request_id" in data
    assert "X-Request-ID" in response.headers
    assert "X-Process-Time-Ms" in response.headers

