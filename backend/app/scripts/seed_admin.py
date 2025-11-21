# app/scripts/seed_admin.py
from app.db import SessionLocal
from app.models.user import User
from app.core.security import hash_password

def run():
    db = SessionLocal()
    try:
        email = "daniel.bonilla@ceipa.edu.co"
        u = db.query(User).filter(User.email == email).first()
        if not u:
            u = User(
                name="Admin",
                email=email,
                role="ADMIN",
                password_hash=hash_password("Admin#12345"),
            )
            db.add(u)
            db.commit()
            print("✅ Admin creado: daniel.bonilla@ceipa.edu.co / Admin#12345")
        else:
            print("ℹ️ Admin ya existe")
    finally:
        db.close()

if __name__ == "__main__":
    run()
