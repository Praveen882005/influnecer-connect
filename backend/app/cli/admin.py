import argparse
import asyncio
import sys
from sqlalchemy import select
from app.core.config import settings
from app.core.database import get_db_session
from app.core.security import hash_password
from app.models.entities import AuditEvent, User, UserRole


async def bootstrap_admin(email: str, password: str, full_name: str) -> None:
    """
    Creates or promotes an administrator account.
    Development/Staging only. Protected against production usage.
    """
    if settings.ENVIRONMENT not in ("development", "staging", "testing"):
        print(
            f"ERROR: Admin bootstrap CLI is prohibited in environment '{settings.ENVIRONMENT}'.",
            file=sys.stderr,
        )
        sys.exit(1)

    if len(password) < 8:
        print("ERROR: Password must be at least 8 characters long.", file=sys.stderr)
        sys.exit(1)

    async with get_db_session() as db:
        res = await db.execute(select(User).where(User.email == email))
        user = res.scalar_one_or_none()

        if user:
            user.role = UserRole.ADMIN
            user.hashed_password = hash_password(password)
            user.full_name = full_name
            user.is_active = True
            print(f"Updated existing user '{email}' to Administrator.")
        else:
            user = User(
                email=email,
                hashed_password=hash_password(password),
                full_name=full_name,
                role=UserRole.ADMIN,
                is_active=True,
            )
            db.add(user)
            await db.flush()
            print(f"Created new Administrator account '{email}'.")

        audit = AuditEvent(
            user_id=user.id,
            action="ADMIN_BOOTSTRAP_CLI",
            resource_type="user",
            resource_id=str(user.id),
            status="success",
            details={"email": email, "environment": settings.ENVIRONMENT},
        )
        db.add(audit)
        await db.commit()

    print(f"Successfully bootstrapped Administrator '{email}' (id={user.id}).")


def main():
    parser = argparse.ArgumentParser(description="Brand Bridge Development Admin Bootstrap CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    create_parser = subparsers.add_parser("create-admin", help="Create or promote an administrator account")
    create_parser.add_argument("--email", required=True, help="Administrator email address")
    create_parser.add_argument("--password", required=True, help="Administrator password (min 8 chars)")
    create_parser.add_argument("--name", default="System Administrator", help="Full name of administrator")

    args = parser.parse_args()
    if args.command == "create-admin":
        asyncio.run(bootstrap_admin(email=args.email, password=args.password, full_name=args.name))


if __name__ == "__main__":
    main()
