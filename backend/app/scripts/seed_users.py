# app/scripts/seed_users.py
from faker import Faker
from sqlalchemy.orm import Session
from app.db import SessionLocal
from app.models.user import User
from app.core.security import hash_password

fake = Faker()

def seed(n: int = 20, default_role: str = "PUBLICO"):
    db: Session = SessionLocal()
    try:
        for _ in range(n):
            name = fake.name()
            email = fake.unique.email().lower()
            password_hash = hash_password("Test#12345")
            u = User(
                name=name.strip(),
                email=email,
                role=default_role,
                password_hash=password_hash,
            )
            db.add(u)
        db.commit()
        print(f"✅ Insertados {n} usuarios de prueba (rol={default_role})")
    finally:
        db.close()

if __name__ == "__main__":
    seed(25)
