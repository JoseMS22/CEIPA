# app/models/__init__.py
from .user import User  # <- importante para que se importe y registre la tabla
from .country import Country
from .category import Category
from .indicator import Indicator
from .scenario import Scenario
from .weights import CategoryWeight, IndicatorWeight
from .indicator_value import IndicatorValue
from .public_description import PublicDescription