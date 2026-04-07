from fastapi import APIRouter, Request, HTTPException, Depends
import stripe
import json
import uuid
from datetime import datetime, timezone, timedelta
from database import db
from dependencies import require_user
from models import User
from config import logger, STRIPE_API_KEY, MONTHLY_PRICE_EUR, ANNUAL_PRICE_EUR, TRIAL_DAYS
from services import send_cancellation_email, send_subscription_activation_email

router = APIRouter(tags=["payments"])

TRIAL_PERIOD = timedelta(days=TRIAL_DAYS)
stripe.api_key = STRIPE_API_KEY


@router.get("/payments/status")
async def get_payment_status(user: User = Depends(require_user)):
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    is_premium = user_doc.get("is_premium", False)
    subscription_plan = user_doc.get("subscription_plan", None)
    subscription_id = user_doc.get("stripe_subscription_id", None)
    created_at = user_doc.get("created_at")
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at)
    if created_at and created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    trial_end = created_at + TRIAL_PERIOD if created_at else now
    trial_remaining = max(0, (trial_end - now).days)
    trial_active = trial_remaining > 0
    if is_premium and subscription_id:
        try:
            sub = stripe.Subscription.retrieve(subscription_id)
            if sub.status not in ("active", "trialing"):
                await db.users.update_one({"user_id": user.user_id}, {"$set": {"is_premium": False, "subscription_status": sub.status}})
                is_premium = False
        except Exception as e:
            logger.error(f"Stripe subscription check error: {e}")
    return {"is_premium": is_premium, "subscription_plan": subscription_plan, "trial_active": trial_active, "trial_days_remaining": trial_remaining, "trial_end_date": trial_end.isoformat(), "has_access": is_premium or trial_active, "monthly_price_eur": MONTHLY_PRICE_EUR, "annual_price_eur": ANNUAL_PRICE_EUR, "cancel_at_period_end": user_doc.get("cancel_at_period_end", False), "access_until": user_doc.get("access_until", None)}


@router.post("/payments/create-checkout")
async def create_checkout(request: Request, user: User = Depends(require_user)):
    body = await request.json()
    origin_url = body.get("origin_url", "")
    plan = body.get("plan", "monthly")
    if not origin_url:
        raise HTTPException(status_code=400, detail="origin_url required")
    user_doc = await db.users.find_one({"user_id": user.user_id})
    if user_doc and user_doc.get("is_premium"):
        raise HTTPException(status_code=400, detail="Already subscribed")
    success_url = f"{origin_url}/payment-success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin_url}/upgrade"
    if plan == "annual":
        unit_amount = int(ANNUAL_PRICE_EUR * 100)
        interval = "year"
        product_name = "NutriOS Pro \u2014 Annual"
    else:
        unit_amount = int(MONTHLY_PRICE_EUR * 100)
        interval = "month"
        product_name = "NutriOS Pro \u2014 Monthly"
    try:
        session = stripe.checkout.Session.create(
            mode="subscription", payment_method_types=["card"],
            line_items=[{"price_data": {"currency": "eur", "unit_amount": unit_amount, "product_data": {"name": product_name}, "recurring": {"interval": interval}}, "quantity": 1}],
            success_url=success_url, cancel_url=cancel_url, customer_email=user.email,
            metadata={"user_id": user.user_id, "email": user.email, "plan": plan},
        )
    except Exception as e:
        logger.error(f"Stripe checkout creation error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create checkout session")
    await db.payment_transactions.insert_one({"id": str(uuid.uuid4()), "session_id": session.id, "user_id": user.user_id, "email": user.email, "plan": plan, "amount": ANNUAL_PRICE_EUR if plan == "annual" else MONTHLY_PRICE_EUR, "currency": "eur", "payment_status": "initiated", "created_at": datetime.now(timezone.utc)})
    return {"url": session.url, "session_id": session.id}


@router.get("/payments/checkout/status/{session_id}")
async def check_checkout_status(session_id: str, user: User = Depends(require_user)):
    try:
        session = stripe.checkout.Session.retrieve(session_id)
    except Exception as e:
        logger.error(f"Stripe status check error: {e}")
        raise HTTPException(status_code=500, detail="Failed to check payment status")
    payment_status = session.payment_status
    status = session.status
    tx = await db.payment_transactions.find_one({"session_id": session_id})
    if tx and tx.get("payment_status") != "paid" and payment_status == "paid":
        plan = tx.get("plan") or session.metadata.get("plan", "monthly")
        sub_id = session.subscription
        await db.payment_transactions.update_one({"session_id": session_id}, {"$set": {"payment_status": "paid", "status": status, "stripe_subscription_id": sub_id, "updated_at": datetime.now(timezone.utc)}})
        user_id = tx.get("user_id", user.user_id)
        await db.users.update_one({"user_id": user_id}, {"$set": {"is_premium": True, "subscription_plan": plan, "stripe_subscription_id": sub_id, "subscription_status": "active", "premium_since": datetime.now(timezone.utc)}})
        logger.info(f"User {user_id} subscribed to {plan} plan via checkout {session_id}")
        # Send subscription activation email (fire-and-forget)
        import asyncio
        asyncio.create_task(send_subscription_activation_email(user.email, user.name, plan))
    return {"status": status, "payment_status": payment_status}


@router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    try:
        payload = json.loads(body)
        event_type = payload.get("type", "")
        data = payload.get("data", {}).get("object", {})
        logger.info(f"Stripe webhook: {event_type}")
        if event_type == "checkout.session.completed":
            session_id = data.get("id", "")
            payment_status = data.get("payment_status", "")
            metadata = data.get("metadata", {})
            sub_id = data.get("subscription", "")
            if payment_status == "paid":
                tx = await db.payment_transactions.find_one({"session_id": session_id})
                if tx and tx.get("payment_status") != "paid":
                    plan = tx.get("plan") or metadata.get("plan", "monthly")
                    await db.payment_transactions.update_one({"session_id": session_id}, {"$set": {"payment_status": "paid", "status": "complete", "stripe_subscription_id": sub_id, "updated_at": datetime.now(timezone.utc)}})
                    user_id = tx.get("user_id") or metadata.get("user_id")
                    if user_id:
                        await db.users.update_one({"user_id": user_id}, {"$set": {"is_premium": True, "subscription_plan": plan, "stripe_subscription_id": sub_id, "subscription_status": "active", "premium_since": datetime.now(timezone.utc)}})
                        logger.info(f"Webhook: User {user_id} subscribed to {plan}")
        elif event_type in ("customer.subscription.deleted", "customer.subscription.updated"):
            sub_id = data.get("id", "")
            sub_status = data.get("status", "")
            if sub_status in ("canceled", "unpaid", "past_due", "incomplete_expired"):
                user_doc = await db.users.find_one({"stripe_subscription_id": sub_id})
                if user_doc:
                    await db.users.update_one({"stripe_subscription_id": sub_id}, {"$set": {"is_premium": False, "subscription_status": sub_status}})
                    logger.info(f"Webhook: Subscription {sub_id} status={sub_status}, access revoked")
        elif event_type == "invoice.payment_succeeded":
            sub_id = data.get("subscription", "")
            if sub_id:
                await db.users.update_one({"stripe_subscription_id": sub_id}, {"$set": {"is_premium": True, "subscription_status": "active"}})
        elif event_type == "invoice.payment_failed":
            sub_id = data.get("subscription", "")
            if sub_id:
                await db.users.update_one({"stripe_subscription_id": sub_id}, {"$set": {"subscription_status": "past_due"}})
    except Exception as e:
        logger.error(f"Webhook error: {e}")
    return {"received": True}


@router.post("/payments/cancel-subscription")
async def cancel_subscription(user: User = Depends(require_user)):
    user_doc = await db.users.find_one({"user_id": user.user_id})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    if not user_doc.get("is_premium"):
        raise HTTPException(status_code=400, detail="No active subscription")
    sub_id = user_doc.get("stripe_subscription_id")
    if not sub_id:
        raise HTTPException(status_code=400, detail="No subscription found")
    try:
        subscription = stripe.Subscription.modify(sub_id, cancel_at_period_end=True)
        period_end = datetime.fromtimestamp(subscription.current_period_end, tz=timezone.utc)
        access_until = period_end.strftime("%B %d, %Y")
        await db.users.update_one({"user_id": user.user_id}, {"$set": {"subscription_status": "cancelling", "cancel_at_period_end": True, "access_until": period_end.isoformat()}})
        await db.payment_transactions.insert_one({"id": str(uuid.uuid4()), "user_id": user.user_id, "email": user.email, "type": "cancellation", "stripe_subscription_id": sub_id, "access_until": period_end.isoformat(), "plan": user_doc.get("subscription_plan", "monthly"), "created_at": datetime.now(timezone.utc)})
        plan = user_doc.get("subscription_plan", "monthly")
        await send_cancellation_email(email=user.email, name=user_doc.get("name", ""), plan=plan, access_until=access_until)
        logger.info(f"Subscription {sub_id} cancelled for user {user.user_id}, access until {access_until}")
        return {"message": "Subscription cancelled", "access_until": period_end.isoformat(), "access_until_formatted": access_until}
    except stripe.error.StripeError as e:
        logger.error(f"Stripe cancel error: {e}")
        raise HTTPException(status_code=500, detail="Failed to cancel subscription")
    except Exception as e:
        logger.error(f"Cancel error: {e}")
        raise HTTPException(status_code=500, detail="Failed to cancel subscription")
