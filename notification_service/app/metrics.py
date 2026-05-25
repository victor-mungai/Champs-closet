from threading import Lock

_lock = Lock()
_counters = {
    'events_processed_total': 0,
    'events_failed_total': 0,
    'customer_messages_sent_total': 0,
    'admin_messages_sent_total': 0,
    'duplicate_events_total': 0,
}


def increment(metric: str, value: int = 1) -> None:
    with _lock:
        _counters[metric] = _counters.get(metric, 0) + value


def snapshot() -> dict[str, int]:
    with _lock:
        return dict(_counters)


def render_prometheus() -> str:
    data = snapshot()
    lines = []
    for key, value in data.items():
        lines.append(f'# TYPE {key} counter')
        lines.append(f'{key} {value}')
    return '\n'.join(lines) + '\n'
