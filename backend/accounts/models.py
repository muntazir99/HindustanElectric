from django.contrib.auth.models import AbstractUser, UserManager as DjangoUserManager
from django.db import models


class UserManager(DjangoUserManager):
    def create_superuser(self, username, email=None, password=None, **extra_fields):
        extra_fields.setdefault("role", User.Role.OWNER)
        return super().create_superuser(username, email, password, **extra_fields)


class User(AbstractUser):
    """
    A person who uses the shop system.

    `role` is the single source of truth for access: owners get full access
    including Django admin; staff only use the React app for daily work.
    """

    class Role(models.TextChoices):
        OWNER = "owner", "Owner"
        STAFF = "staff", "Staff"

    role = models.CharField(max_length=10, choices=Role.choices, default=Role.STAFF)

    objects = UserManager()

    @property
    def is_owner(self):
        return self.role == self.Role.OWNER

    def save(self, *args, **kwargs):
        self.is_staff = self.is_owner
        self.is_superuser = self.is_owner
        super().save(*args, **kwargs)
