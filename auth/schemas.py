from marshmallow import Schema, fields, validate

class LoginSchema(Schema):
    username = fields.Str(required=True)
    password = fields.Str(required=True)

class CreateUserSchema(Schema):
    username = fields.Str(required=True, validate=validate.Length(min=3))
    password = fields.Str(required=True, validate=validate.Length(min=8))
    role = fields.Str(validate=validate.OneOf(['user', 'admin']))