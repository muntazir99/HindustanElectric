"""
How a bill is calculated. This is the only place GST and totals are worked out;
the counter screen, the printed bill and the records all use its results.

Rules (docs/PLAN.md §7.2):
1. gross = quantity × rate; line discount = gross × discount %.
2. A bill discount (₹) is shared across lines in proportion to their value after line
   discounts; the largest line takes the last paisa so the shares add up exactly.
3. Rates include GST: line total is what's left; taxable = total × 100 / (100 + GST %).
   Rates exclude GST: taxable is what's left; tax = taxable × GST %.
4. Same state: CGST = half the tax, SGST = the rest. Other state: IGST = all of it.
5. Bill total = sum of line totals, rounded to the nearest rupee if round_off is on.
Every amount is rounded to the paisa, half up.
"""

from dataclasses import dataclass, field
from decimal import ROUND_HALF_UP, Decimal

from core.numbers import money

ZERO = Decimal("0")
HUNDRED = Decimal("100")


class PricingError(Exception):
    """Input that can't be billed; the message is shown to the user."""


@dataclass
class LineInput:
    quantity: Decimal
    rate: Decimal
    gst_rate: Decimal
    discount_percent: Decimal = ZERO


@dataclass
class LineResult:
    gross: Decimal
    discount: Decimal  # line discount + its share of the bill discount
    taxable: Decimal
    cgst: Decimal
    sgst: Decimal
    igst: Decimal
    total: Decimal

    @property
    def tax(self):
        return self.cgst + self.sgst + self.igst


@dataclass
class BillResult:
    lines: list = field(default_factory=list)
    gross: Decimal = ZERO
    discount: Decimal = ZERO
    taxable: Decimal = ZERO
    cgst: Decimal = ZERO
    sgst: Decimal = ZERO
    igst: Decimal = ZERO
    subtotal: Decimal = ZERO  # before round off
    round_off: Decimal = ZERO
    total: Decimal = ZERO


def _share_bill_discount(nets, bill_discount):
    """Split bill_discount across lines in proportion to nets; shares add up exactly."""
    if bill_discount == ZERO or not nets:
        return [ZERO] * len(nets)
    whole = sum(nets, ZERO)
    if bill_discount > whole:
        raise PricingError(f"Bill discount ₹{bill_discount} is more than the bill (₹{whole}).")
    largest = max(range(len(nets)), key=lambda i: nets[i])
    shares = [money(bill_discount * net / whole) if i != largest else ZERO for i, net in enumerate(nets)]
    shares[largest] = bill_discount - sum(shares, ZERO)
    return shares


def price_bill(lines, *, rates_include_tax=True, bill_discount=ZERO, same_state=True, round_off=True):
    bill_discount = money(bill_discount or ZERO)
    if bill_discount < ZERO:
        raise PricingError("Bill discount can't be negative.")

    nets, line_discounts, grosses = [], [], []
    for number, line in enumerate(lines, start=1):
        if line.quantity <= ZERO:
            raise PricingError(f"Line {number}: quantity must be more than zero.")
        if line.rate < ZERO:
            raise PricingError(f"Line {number}: rate can't be negative.")
        if not ZERO <= line.discount_percent <= HUNDRED:
            raise PricingError(f"Line {number}: discount must be between 0 and 100%.")
        gross = money(line.quantity * line.rate)
        discount = money(gross * line.discount_percent / HUNDRED)
        grosses.append(gross)
        line_discounts.append(discount)
        nets.append(gross - discount)

    shares = _share_bill_discount(nets, bill_discount)
    result = BillResult()
    for line, gross, discount, net, share in zip(lines, grosses, line_discounts, nets, shares):
        amount = net - share
        if rates_include_tax:
            total = amount
            taxable = money(amount * HUNDRED / (HUNDRED + line.gst_rate))
            tax = total - taxable
        else:
            taxable = amount
            tax = money(taxable * line.gst_rate / HUNDRED)
            total = taxable + tax
        if same_state:
            cgst = money(tax / 2)
            sgst, igst = tax - cgst, ZERO
        else:
            cgst, sgst, igst = ZERO, ZERO, tax
        result.lines.append(LineResult(gross, discount + share, taxable, cgst, sgst, igst, total))

    for name in ("gross", "discount", "taxable", "cgst", "sgst", "igst"):
        setattr(result, name, sum((getattr(line, name) for line in result.lines), ZERO))
    result.subtotal = sum((line.total for line in result.lines), ZERO)
    result.total = result.subtotal.quantize(Decimal("1"), rounding=ROUND_HALF_UP) if round_off else result.subtotal
    result.round_off = result.total - result.subtotal
    return result
