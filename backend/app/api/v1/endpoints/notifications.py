from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.entities import Notification, User
from app.schemas.workflow import NotificationListResponse, NotificationOut

router = APIRouter()


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _to_notification_out(notif: Notification) -> NotificationOut:
    return NotificationOut(
        id=notif.id,
        user_id=notif.user_id,
        title=notif.title,
        message=notif.message,
        notification_type=notif.notification_type or "system",
        is_read=notif.is_read,
        link_url=notif.link_url,
        data=notif.data or {},
        read_at=notif.read_at,
        created_at=notif.created_at,
    )


@router.get("/", response_model=NotificationListResponse)
async def list_notifications(
    unread_only: bool = Query(False, description="Filter for unread notifications only"),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List user notifications and total unread count.
    Transparently discloses in-app persistent notification delivery mode.
    """
    # Count unread notifications
    count_res = await db.execute(
        select(func.count(Notification.id)).where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
        )
    )
    unread_count = count_res.scalar() or 0

    # Fetch notification items
    query = (
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
    )
    if unread_only:
        query = query.where(Notification.is_read == False)

    res = await db.execute(query)
    notifications = res.scalars().all()

    return NotificationListResponse(
        unread_count=unread_count,
        notifications=[_to_notification_out(n) for n in notifications],
        delivery_provider_disclaimer=(
            "Persistent in-app notification delivery active. External SMS and email alerts are disabled without configured provider credentials."
        ),
    )


@router.patch("/{notification_id}/read", response_model=NotificationOut)
@router.put("/{notification_id}/read", response_model=NotificationOut, summary="Alias for PATCH")
async def mark_notification_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark an individual notification as read."""
    res = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
    )
    notification = res.scalar_one_or_none()
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Notification {notification_id} not found or not owned by you",
        )

    if not notification.is_read:
        notification.is_read = True
        notification.read_at = _utcnow()
        await db.commit()
        await db.refresh(notification)

    return _to_notification_out(notification)


@router.post("/mark-all-read")
async def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark all unread notifications for the authenticated user as read."""
    now = _utcnow()
    res = await db.execute(
        update(Notification)
        .where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
        )
        .values(is_read=True, read_at=now)
    )
    await db.commit()
    return {"updated_count": res.rowcount}
