from django.contrib.auth.models import AbstractUser, UserManager as DjangoUserManager
from django.db import models


class UserManager(DjangoUserManager):
    def create_superuser(self, username, email=None, password=None, **extra_fields):
        extra_fields.setdefault("role", User.Role.OWNER)
        return super().create_superuser(username, email, password, **extra_fields)


class User(AbstractUser):
    """
    A person who uses the shop system.

    `role` decides who is the owner: owners get full access including Django admin. Staff use the React
    app, and only for the jobs switched on in `access` (see accounts.access).
    """

    class Role(models.TextChoices):
        OWNER = "owner", "Owner"
        STAFF = "staff", "Staff"

    role = models.CharField(max_length=10, choices=Role.choices, default=Role.STAFF)
    access = models.JSONField(default=list, blank=True, help_text="Switches the owner turned on (staff only).")

    objects = UserManager()

    @property
    def is_owner(self):
        return self.role == self.Role.OWNER

    def can(self, code):
        """May this person do `code` (an accounts.access switch)? The owner can do everything."""
        return self.is_active and (self.is_owner or code in (self.access or []))

    def switches(self):
        from .access import CODES, clean

        return list(CODES) if self.is_owner else clean(self.access)

    def save(self, *args, **kwargs):
        self.is_staff = self.is_owner
        self.is_superuser = self.is_owner
        super().save(*args, **kwargs)
