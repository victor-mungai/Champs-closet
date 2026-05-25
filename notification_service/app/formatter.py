from app.schemas import OrderPaidData


def _format_amount(value: float) -> str:
    amount = float(value)
    if amount.is_integer():
        return f'{int(amount):,}'
    return f'{amount:,.2f}'


def build_sms(order: OrderPaidData, link: str) -> str:
    return (
        "Champ's Closet\n\n"
        "Your order is confirmed.\n\n"
        f"Total: {_format_amount(order.amount)} Ksh\n\n"
        f"View receipt:\n{link}\n\n"
        "Thank you for shopping with us."
    )


def build_admin_sms(order: OrderPaidData, link: str) -> str:
    return (
        "Champ's Closet Admin Alert\n\n"
        "New order paid.\n\n"
        f"Order: {order.order_id}\n"
        f"Amount: {_format_amount(order.amount)} Ksh\n"
        f"Receipt: {order.receipt}\n"
        f"Customer: {order.phone}\n"
        f"Receipt link: {link}"
    )
