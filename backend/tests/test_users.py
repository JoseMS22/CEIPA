# tests/test_users.py
from uuid import uuid4

def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}

def test_list_requires_auth(client):
    r = client.get("/api/v1/users/paged?page=1&limit=10")
    assert r.status_code in (401, 403)

def test_admin_can_create_user_and_see_in_paged(client, admin_token, unique_email):
    # Crear usuario (ADMIN)
    payload = {
        "name": "User Test",
        "email": unique_email,
        "password": "Test#12345",
    }
    r = client.post(
        "/api/v1/users",
        json=payload,
        headers=_auth_headers(admin_token),
    )
    assert r.status_code == 201, r.text
    new_user = r.json()
    assert new_user["email"] == unique_email
    assert "id" in new_user
    user_id = new_user["id"]

    # Listado paginado (ADMIN)
    r2 = client.get(
        "/api/v1/users/paged?page=1&limit=10",
        headers=_auth_headers(admin_token),
    )
    assert r2.status_code == 200
    body = r2.json()
    assert "items" in body and isinstance(body["items"], list)
    # Debe aparecer (no necesariamente en la primera página, pero con 10 debería)
    assert any(u["id"] == user_id for u in body["items"])

def test_create_conflict_email(client, admin_token, unique_email):
    # Crear el primero
    r1 = client.post(
        "/api/v1/users",
        json={"name": "AA", "email": unique_email, "password": "Test#12345"},
        headers=_auth_headers(admin_token),
    )
    assert r1.status_code == 201, r1.text

    # Intentar duplicado
    r2 = client.post(
        "/api/v1/users",
        json={"name": "BB", "email": unique_email, "password": "Test#12345"},
        headers=_auth_headers(admin_token),
    )
    assert r2.status_code == 409  # conflicto por UNIQUE(email)

def test_self_update_and_forbidden_update_others(client, admin_token):
    # 1) ADMIN crea un usuario normal
    email_me = f"user_{uuid4().hex[:8]}@example.com"
    r = client.post(
        "/api/v1/users",
        json={"name": "Self", "email": email_me, "password": "Self#12345"},
        headers=_auth_headers(admin_token),
    )
    assert r.status_code == 201, r.text
    user_self = r.json()
    uid = user_self["id"]

    # 2) Login como ese usuario
    r2 = client.post(
        "/api/v1/auth/login",
        data={"username": email_me, "password": "Self#12345"},
    )
    assert r2.status_code == 200, r2.text
    token_self = r2.json()["access_token"]

    # 3) Ese usuario puede actualizarse a sí mismo
    r3 = client.put(
        f"/api/v1/users/{uid}",
        json={"name": "Self Updated"},
        headers=_auth_headers(token_self),
    )
    assert r3.status_code == 200, r3.text
    assert r3.json()["name"] == "Self Updated"

    # 4) Ese usuario NO puede actualizar a otro usuario (p.ej. admin id=1 si existe)
    r4 = client.put(
        "/api/v1/users/1",
        json={"name": "Hacked"},
        headers=_auth_headers(token_self),
    )
    assert r4.status_code in (403, 404)  # 403 si existe; 404 si admin no es 1

def test_delete_requires_admin(client, admin_token):
    # Crear usuario a borrar
    email_del = f"del_{uuid4().hex[:8]}@example.com"
    r = client.post(
        "/api/v1/users",
        json={"name": "To Delete", "email": email_del, "password": "Del#12345"},
        headers=_auth_headers(admin_token),
    )
    assert r.status_code == 201
    uid = r.json()["id"]

    # Borrar como ADMIN
    r2 = client.delete(
        f"/api/v1/users/{uid}",
        headers=_auth_headers(admin_token),
    )
    assert r2.status_code == 204

def test_delete_forbidden_for_non_admin(client, admin_token):
    # Crear usuario A y B
    email_a = f"a_{uuid4().hex[:8]}@example.com"
    email_b = f"b_{uuid4().hex[:8]}@example.com"

    ra = client.post(
        "/api/v1/users",
        json={"name": "AA", "email": email_a, "password": "A#123456b"},
        headers=_auth_headers(admin_token),
    )
    assert ra.status_code == 201
    ua_id = ra.json()["id"]

    rb = client.post(
        "/api/v1/users",
        json={"name": "BB", "email": email_b, "password": "B#12345re"},
        headers=_auth_headers(admin_token),
    )
    assert rb.status_code == 201
    ub_id = rb.json()["id"]

    # Login como usuario A (no admin)
    la = client.post("/api/v1/auth/login", data={"username": email_a, "password": "A#123456b"})
    assert la.status_code == 200
    token_a = la.json()["access_token"]

    # A intenta borrar a B -> 403
    rdel = client.delete(
        f"/api/v1/users/{ub_id}",
        headers=_auth_headers(token_a),
    )
    assert rdel.status_code == 403
