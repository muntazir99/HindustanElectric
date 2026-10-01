from django.core.exceptions import ValidationError
from django.core.validators import RegexValidator
from django.db import models

gstin_validator = RegexValidator(
    r"^[0-9]{2}[A-Z0-9]{13}$",
    "GSTIN must be 15 characters: 2-digit state code followed by 13 letters/digits.",
)


class ShopSettings(models.Model):
    """
    The shop's own details, printed on bills and used across the app.
    There is exactly one row; use ShopSettings.load() to get it.
    """

    name = models.CharField(max_length=120, default="Hindustan Electric")
    gstin = models.CharField("GSTIN", max_length=15, blank=True, validators=[gstin_validator])
    state_code = models.CharField(
        max_length=2,
        default="10",
        help_text="GST state code of the shop. Bihar is 10.",
        validators=[RegexValidator(r"^[0-9]{2}$", "State code is two digits.")],
    )
    address = models.TextField(blank=True)
    phone = models.CharField(max_length=30, blank=True)
    email = models.EmailField(blank=True)

    bank_name = models.CharField(max_length=120, blank=True)
    bank_branch = models.CharField(max_length=120, blank=True)
    bank_account_number = models.CharField(max_length=30, blank=True)
    bank_ifsc = models.CharField("Bank IFSC", max_length=11, blank=True)

    invoice_terms = models.TextField(
        blank=True,
        help_text="Printed at the bottom of every bill, one term per line.",
    )

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "shop settings"
        verbose_name_plural = "shop settings"

    def __str__(self):
        return self.name

    def clean(self):
        if self.gstin and self.gstin[:2] != self.state_code:
            raise ValidationError({"gstin": "The first two digits of the GSTIN must match the state code."})

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("Shop settings cannot be deleted.")

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj
