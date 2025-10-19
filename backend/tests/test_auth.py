# tests/test_auth.py
def test_login_with_admin(client, admin_creds):
    r = client.post("/api/v1/auth/login", data=admin_creds)
    assert r.status_code == 200
    body = r.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"

def test_me_with_token(client, admin_token):
    r = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    me = r.json()
    assert me["email"] == "admin@ceipa.com"
    assert me["role"] == "ADMIN"
