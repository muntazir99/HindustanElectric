from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db.models import Sum

from catalog.models import Item


def stock_mismatches():
    """Items whose cached stock differs from the sum of their ledger rows."""
    ledger = dict(
        Item.objects.annotate(total=Sum("movements__quantity")).values_list("pk", "total")
    )
    return [
        (item, ledger.get(item.pk) or Decimal("0"))
        for item in Item.objects.select_related("product__brand")
        if item.stock_qty != (ledger.get(item.pk) or Decimal("0"))
    ]


class Command(BaseCommand):
    help = "Check every item's stock equals the sum of its stock ledger."

    def handle(self, *args, **options):
        mismatches = stock_mismatches()
        for item, ledger_total in mismatches:
            self.stderr.write(f"{item.code} {item}: stock {item.stock_qty}, ledger {ledger_total}")
        if mismatches:
            raise CommandError(f"{len(mismatches)} item(s) out of sync with the ledger.")
        self.stdout.write(self.style.SUCCESS(f"All {Item.objects.count()} items match the ledger."))
