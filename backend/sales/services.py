"""
Making, finalising and cancelling bills. Finalising is the only way a sale touches
stock, khata or cash, and it does all three in one transaction (docs/PLAN.md §7.5).
"""

from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from core.numbers import cost, money, qty
from shop.models import ShopSettings
from stock.models import StockMovement
from stock.services import lock_items, record_movement, weighted_average_cost

from .models import Invoice, InvoiceLine, LedgerEntry, Payment
from .numbering import next_number
from .pricing import LineInput, PricingError, price_bill

ZERO = Decimal("0")
WALK_IN_DETAILS_ABOVE = Decimal("50000")


class BillingError(Exception):
    """A billing action that is not allowed; the message is shown to the user."""


def default_rate(item, unit):
    """Shelf price for one of this unit: pack price, else base price × pack size."""
    if not unit.is_base and unit.selling_price is not None:
        return unit.selling_price
    if item.selling_price is None:
        return None
    return money(item.selling_price * unit.factor)


def apply_pricing(invoice, lines=None):
    """Recalculate every line and the totals from quantities, rates and discounts."""
    shop = ShopSettings.load()
    lines = lines if lines is not None else list(invoice.lines.select_related("unit"))
    try:
        result = price_bill(
            [LineInput(line.quantity, line.rate, line.gst_rate, line.discount_percent) for line in lines],
            rates_include_tax=invoice.rates_include_tax,
            bill_discount=invoice.bill_discount,
            same_state=invoice.place_of_supply == shop.state_code,
            round_off=shop.round_off_bills,
        )
    except PricingError as exc:
        raise BillingError(str(exc)) from exc
    for line, priced in zip(lines, result.lines):
        line.base_quantity = qty(line.quantity * line.unit.factor)
        line.gross = priced.gross
        line.discount = priced.discount
        line.taxable_value = priced.taxable
        line.cgst, line.sgst, line.igst = priced.cgst, priced.sgst, priced.igst
        line.total = priced.total
        line.save()
    invoice.gross_total = result.gross
    invoice.discount_total = result.discount
    invoice.taxable_total = result.taxable
    invoice.cgst_total, invoice.sgst_total, invoice.igst_total = result.cgst, result.sgst, result.igst
    invoice.round_off = result.round_off
    invoice.total = result.total
    invoice.save()
    return result


HEADER_FIELDS = (
    "customer", "buyer_name", "buyer_phone", "buyer_gstin", "buyer_address",
    "place_of_supply", "rates_include_tax", "bill_discount", "note", "held",
)


def save_draft(invoice, *, lines, user, **header):
    """
    Replace a draft's header and lines and recalculate it. Nothing outside the bill changes.
    lines: dicts with item, unit, quantity and optional rate, discount_percent, gst_rate.
    """
    if invoice.pk and invoice.status != Invoice.Status.DRAFT:
        raise BillingError("A finalised bill can't be changed.")
    for field, value in header.items():
        if field not in HEADER_FIELDS:
            raise ValueError(f"Unknown bill field {field}")
        setattr(invoice, field, value)
    if not invoice.pk:
        invoice.created_by = user
    customer = invoice.customer
    with transaction.atomic():
        invoice.save()
        invoice.lines.all().delete()
        saved = []
        for position, data in enumerate(lines):
            item, unit = data["item"], data["unit"]
            if unit.item_id != item.pk:
                raise BillingError(f"{item}: the chosen unit belongs to a different item.")
            rate = data.get("rate")
            if rate is None:
                rate = default_rate(item, unit)
            if rate is None:
                raise BillingError(f"{item} has no selling price. Type the rate.")
            discount = data.get("discount_percent")
            if discount is None:
                discount = customer.default_discount_percent if customer else ZERO
            saved.append(
                InvoiceLine.objects.create(
                    invoice=invoice,
                    position=position,
                    item=item,
                    unit=unit,
                    description=item.name,
                    unit_name=unit.name,
                    hsn_code=item.product.hsn_code,
                    quantity=qty(data["quantity"]),
                    base_quantity=qty(Decimal(data["quantity"]) * unit.factor),
                    rate=money(rate),
                    discount_percent=discount,
                    gst_rate=item.product.gst_rate if data.get("gst_rate") is None else data["gst_rate"],
                )
            )
        apply_pricing(invoice, saved)
    return invoice


def _check_credit_limit(customer, credit, user, warnings):
    if customer.credit_limit is None:
        return
    new_balance = customer.balance() + credit
    if new_balance > customer.credit_limit:
        message = (
            f"{customer.name} would owe ₹{new_balance}, over their credit limit of ₹{customer.credit_limit}."
        )
        if not user.is_owner:
            raise BillingError(f"{message} Only the owner can allow this.")
        warnings.append(message)


def _check_prices(lines, items, user, warnings):
    """Nothing may be sold below its average cost, except by the owner (with a warning)."""
    for line in lines:
        item_cost = items[line.item_id].cost_price
        if item_cost is None or line.base_quantity <= 0:
            continue
        price = line.taxable_value / line.base_quantity
        if price < item_cost:
            if not user.is_owner:
                raise BillingError(f"{line.description}: the price is too low. Ask the owner.")
            warnings.append(
                f"{line.description} is sold at ₹{price:.2f}/{items[line.item_id].base_unit} before GST, "
                f"below its average cost of ₹{item_cost:.2f}."
            )


def finalise(invoice, *, payments, user):
    """
    Give the bill its number and apply it: stock out, payments in, khata updated.
    payments: list of (mode, amount). Anything unpaid goes on the customer's khata.
    Returns (invoice, warnings) — warnings are for the owner's eyes.
    """
    shop = ShopSettings.load()
    warnings = []
    with transaction.atomic():
        invoice = Invoice.objects.select_for_update(of=("self",)).select_related("customer").get(pk=invoice.pk)
        if invoice.status != Invoice.Status.DRAFT:
            raise BillingError("This bill is already finalised.")
        lines = list(invoice.lines.select_related("unit", "item__product"))
        if not lines:
            raise BillingError("Add at least one item to the bill.")
        apply_pricing(invoice, lines)

        payments = [(mode, money(amount)) for mode, amount in payments]
        if any(amount <= 0 for _, amount in payments):
            raise BillingError("Each payment must be more than zero.")
        if any(mode not in Payment.Mode.values for mode, _ in payments):
            raise BillingError("Unknown payment mode.")
        paid = sum((amount for _, amount in payments), ZERO)
        if paid > invoice.total:
            raise BillingError(
                f"Payments (₹{paid}) are more than the bill (₹{invoice.total}). Enter the bill amount and give change."
            )
        credit = invoice.total - paid
        customer = invoice.customer
        if credit > 0:
            if customer is None:
                raise BillingError(f"₹{credit} is unpaid. Choose a customer to put it on khata, or take full payment.")
            _check_credit_limit(customer, credit, user, warnings)
        if customer is None and invoice.total > WALK_IN_DETAILS_ABOVE:
            if not (invoice.buyer_name.strip() and invoice.buyer_address.strip()):
                raise BillingError("For a bill over ₹50,000 to a walk-in buyer, enter their name and address (GST rule).")

        items = lock_items([line.item_id for line in lines])
        _check_prices(lines, items, user, warnings)

        if customer:
            invoice.buyer_name = invoice.buyer_name or customer.name
            invoice.buyer_phone = invoice.buyer_phone or customer.phone
            invoice.buyer_gstin = customer.gstin
            invoice.buyer_address = invoice.buyer_address or customer.address
        today = timezone.localdate()
        invoice.number = next_number("invoice", today, shop.invoice_prefix)
        invoice.invoice_date = today
        invoice.status = Invoice.Status.FINAL
        invoice.held = False
        invoice.paid_amount = paid
        invoice.credit_amount = credit
        invoice.finalised_by = user
        invoice.finalised_at = timezone.now()
        invoice.save()

        for line in lines:
            item = items[line.item_id]
            if item.cost_price is not None:
                line.cost_amount = money(line.base_quantity * item.cost_price)
                line.save(update_fields=["cost_amount"])
            record_movement(
                item, StockMovement.Kind.SALE, -line.base_quantity, user,
                unit_cost=item.cost_price, source=line, note=f"Bill {invoice.number}",
            )

        if customer:
            LedgerEntry.objects.create(
                customer=customer, date=today, kind=LedgerEntry.Kind.BILL, debit=invoice.total,
                invoice=invoice, note=f"Bill {invoice.number}", created_by=user,
            )
        for mode, amount in payments:
            payment = Payment.objects.create(
                kind=Payment.Kind.SALE, mode=mode, amount=amount, date=today,
                customer=customer, invoice=invoice, created_by=user,
            )
            if customer:
                LedgerEntry.objects.create(
                    customer=customer, date=today, kind=LedgerEntry.Kind.PAYMENT, credit=amount,
                    invoice=invoice, payment=payment, note=f"Paid with bill {invoice.number}", created_by=user,
                )
    return invoice, warnings


def cancel(invoice, *, reason, user):
    """Undo a finalised bill: goods back, money back, khata reversed. The number stays, marked cancelled."""
    reason = (reason or "").strip()
    if not reason:
        raise BillingError("Give a reason for cancelling.")
    with transaction.atomic():
        invoice = Invoice.objects.select_for_update(of=("self",)).select_related("customer").get(pk=invoice.pk)
        if invoice.status != Invoice.Status.FINAL:
            raise BillingError("Only a finalised bill can be cancelled.")
        lines = list(invoice.lines.all())
        items = lock_items([line.item_id for line in lines])
        today = timezone.localdate()
        for line in lines:
            item = items[line.item_id]
            unit_cost = cost(line.cost_amount / line.base_quantity) if line.cost_amount is not None else None
            if unit_cost is not None:
                item.cost_price = weighted_average_cost(item.stock_qty, item.cost_price, line.base_quantity, unit_cost)
            record_movement(
                item, StockMovement.Kind.SALE_CANCELLED, line.base_quantity, user,
                unit_cost=unit_cost, source=line, note=f"Bill {invoice.number} cancelled",
            )
        customer = invoice.customer
        for paid in invoice.payments.filter(kind=Payment.Kind.SALE):
            refund = Payment.objects.create(
                kind=Payment.Kind.REFUND, mode=paid.mode, amount=paid.amount, date=today, customer=customer,
                invoice=invoice, note=f"Bill {invoice.number} cancelled", created_by=user,
            )
            if customer:
                LedgerEntry.objects.create(
                    customer=customer, date=today, kind=LedgerEntry.Kind.REFUND, debit=refund.amount,
                    invoice=invoice, payment=refund, note=f"Money returned, bill {invoice.number} cancelled",
                    created_by=user,
                )
        if customer:
            LedgerEntry.objects.create(
                customer=customer, date=today, kind=LedgerEntry.Kind.BILL_CANCELLED, credit=invoice.total,
                invoice=invoice, note=f"Bill {invoice.number} cancelled: {reason}", created_by=user,
            )
        invoice.status = Invoice.Status.CANCELLED
        invoice.cancelled_by = user
        invoice.cancelled_at = timezone.now()
        invoice.cancel_reason = reason[:250]
        invoice.save()
    return invoice
