from decimal import Decimal


def plain(number):
    """12.500 -> "12.5", 90.000 -> "90"."""
    text = format(Decimal(number).normalize(), "f")
    return text


def format_quantity(quantity, base_unit, units):
    """
    Show a base-unit quantity using the item's largest pack, the way staff count it:
    395 m with a 90 m coil -> "4 coil + 35 m".
    """
    quantity = Decimal(quantity)
    packs = [unit for unit in units if not unit.is_base and unit.factor > 1]
    if not packs or quantity <= 0:
        return f"{plain(quantity)} {base_unit}"
    pack = max(packs, key=lambda unit: unit.factor)
    whole = int(quantity // pack.factor)
    rest = quantity - whole * pack.factor
    if whole == 0:
        return f"{plain(quantity)} {base_unit}"
    if rest == 0:
        return f"{whole} {pack.name}"
    return f"{whole} {pack.name} + {plain(rest)} {base_unit}"
