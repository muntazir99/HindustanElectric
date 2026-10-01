"""Exact rounding for money and quantities. Never use floats for either."""

from decimal import ROUND_HALF_UP, Decimal

MONEY = Decimal("0.01")
QTY = Decimal("0.001")
COST = Decimal("0.0001")


def to_decimal(value):
    return value if isinstance(value, Decimal) else Decimal(str(value))


def money(value):
    return to_decimal(value).quantize(MONEY, rounding=ROUND_HALF_UP)


def qty(value):
    return to_decimal(value).quantize(QTY, rounding=ROUND_HALF_UP)


def cost(value):
    return to_decimal(value).quantize(COST, rounding=ROUND_HALF_UP)
