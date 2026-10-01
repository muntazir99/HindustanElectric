"""
Document numbers: one unbroken series per financial year (April–March), e.g. HE/26-27/00001.
GST allows at most 16 characters: letters, digits, "/" and "-".
"""

from django.db import IntegrityError, transaction

from .models import DocumentSeries

PREFIXES = {"credit_note": "CN", "receipt": "RC", "quotation": "QT"}


def financial_year_start(day):
    return day.year if day.month >= 4 else day.year - 1


def financial_year_label(day):
    start = financial_year_start(day)
    return f"{start % 100:02d}-{(start + 1) % 100:02d}"


def next_number(series, day, prefix=None):
    """
    Take the next number in `series` for the financial year containing `day`.
    Must run inside transaction.atomic(): the counter row stays locked until commit,
    so two bills finalised at the same moment can't get the same number, and a
    rolled-back bill gives its number back.
    """
    prefix = prefix or PREFIXES[series]
    key = f"{series}/{financial_year_start(day)}"
    counter = DocumentSeries.objects.select_for_update().filter(key=key).first()
    if counter is None:
        try:
            with transaction.atomic():
                DocumentSeries.objects.create(key=key)
        except IntegrityError:
            pass  # created by another bill at the same moment
        counter = DocumentSeries.objects.select_for_update().get(key=key)
    counter.last_number += 1
    counter.save(update_fields=["last_number"])
    return f"{prefix}/{financial_year_label(day)}/{counter.last_number:05d}"
