"""Amounts in words the Indian way: lakh and crore, e.g. "Rupees One Lakh Twenty Thousand Only"."""

from decimal import ROUND_HALF_UP, Decimal

ONES = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
]
TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]


def _below_hundred(n):
    if n < 20:
        return ONES[n]
    return " ".join(part for part in (TENS[n // 10], ONES[n % 10]) if part)


def _below_thousand(n):
    hundreds, rest = divmod(n, 100)
    parts = []
    if hundreds:
        parts.append(f"{ONES[hundreds]} Hundred")
    if rest:
        parts.append(_below_hundred(rest))
    return " ".join(parts)


def number_in_words(n):
    """Whole number in Indian words: 12345678 -> "One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight"."""
    if n == 0:
        return "Zero"
    parts = []
    crore, n = divmod(n, 10_000_000)
    lakh, n = divmod(n, 100_000)
    thousand, n = divmod(n, 1000)
    if crore:
        parts.append(f"{number_in_words(crore)} Crore")
    if lakh:
        parts.append(f"{_below_hundred(lakh)} Lakh")
    if thousand:
        parts.append(f"{_below_hundred(thousand)} Thousand")
    if n:
        parts.append(_below_thousand(n))
    return " ".join(parts)


def rupees_in_words(amount):
    amount = Decimal(amount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    negative = amount < 0
    rupees, paise = divmod(int(abs(amount) * 100), 100)
    text = f"Rupees {number_in_words(rupees)}"
    if paise:
        text += f" and {number_in_words(paise)} Paise"
    return ("Minus " if negative else "") + text + " Only"
