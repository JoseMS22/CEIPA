from typing import Optional
from app.models.indicator import Indicator, IndicatorType, ScaleType

def clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))

class NormalizationError(ValueError):
    pass

def normalize_value(indicator: Indicator, raw: Optional[float]) -> Optional[float]:
    if raw is None:
        return None

    t = indicator.type
    s = indicator.scale

    if s == ScaleType.FIJA_0_10:
        return clamp((float(raw) / 2.0) if t == IndicatorType.IMP else ((10.0 - float(raw)) / 2.0), 0.0, 5.0)

    if s == ScaleType.FIJA_0_100:
        return clamp((float(raw) / 20.0) if t == IndicatorType.IMP else ((100.0 - float(raw)) / 20.0), 0.0, 5.0)

    # VARIABLE
    min_v = indicator.min_value_imp
    max_v = indicator.max_value_dmp
    if min_v is None or max_v is None or float(max_v) <= float(min_v):
        raise NormalizationError("Indicador VARIABLE requiere min_value_imp y max_value_dmp válidos (min < max).")

    r = float(raw); min_v = float(min_v); max_v = float(max_v)
    if t == IndicatorType.IMP:
        return clamp(((r - min_v) / (max_v - min_v)) * 5.0, 0.0, 5.0)
    else:
        return clamp(((max_v - r) / (max_v - min_v)) * 5.0, 0.0, 5.0)
