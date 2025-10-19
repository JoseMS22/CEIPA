# tests/test_health.py
def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert "app" in data

def test_db_health(client):
    r = client.get("/db/health")
    assert r.status_code == 200
    data = r.json()
    assert data["ok"] is True
