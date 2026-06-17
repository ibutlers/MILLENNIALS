# Generate ephemeral E2E secrets
import secrets
print("export PG_PASSWORD={}".format(secrets.token_hex(12)))
print("export BETTER_AUTH_SECRET={}".format(secrets.token_hex(16)))
print("export E2E_INTERNAL_SECRET={}".format(secrets.token_hex(32)))
