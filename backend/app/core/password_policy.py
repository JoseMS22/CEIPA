# app/core/password_policy.py
import re
def validate_password_strength(pw: str) -> None:
    if not (8 <= len(pw) <= 72):
        raise ValueError("La contraseña debe tener entre 8 y 72 caracteres")
    if not re.search(r"[A-Z]", pw): raise ValueError("Debe contener al menos una mayúscula")
    if not re.search(r"[a-z]", pw): raise ValueError("Debe contener al menos una minúscula")
    if not re.search(r"\d", pw):    raise ValueError("Debe contener al menos un dígito")
    if not re.search(r"\W", pw):    raise ValueError("Debe contener al menos un símbolo")
