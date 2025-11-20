# app/core/normalization.py
from typing import Optional
from app.models.indicator import Indicator, IndicatorType

def clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))

class NormalizationError(ValueError):
    pass

def normalize_value(indicator: Indicator, raw: Optional[float]) -> Optional[float]:
    """
    Normaliza un valor (raw) a una escala 0..5 linealmente según:
      - DMP (mayor es mejor):   5 * (valor - min) / (max - min)
      - IMP (menor es mejor):   5 * (max - valor) / (max - min)
    """
    if raw is None:
        return None

    min_v = indicator.min_value
    max_v = indicator.max_value
    if min_v is None or max_v is None or float(max_v) <= float(min_v):
        raise NormalizationError("El indicador requiere min_value y max_value válidos (min < max).")

    r = float(raw)
    lo = float(min_v)
    hi = float(max_v)

    # asegurar que el valor no se salga del rango
    r = clamp(r, lo, hi)

    if indicator.value_type == IndicatorType.DMP:
        # Directamente proporcional (mayor es mejor)
        score = 5 * (r - lo) / (hi - lo)
    else:
        # Inversamente proporcional (menor es mejor)
        score = 5 * (hi - r) / (hi - lo)

    return clamp(score, 0.0, 5.0)
