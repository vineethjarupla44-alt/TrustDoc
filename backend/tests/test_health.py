from fastapi.testclient import TestClient

from backend.app.main import app


def test_api_health_returns_healthy_status() -> None:
    client = TestClient(app)

    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}
