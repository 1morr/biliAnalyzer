"""Tracking and concurrency control for fire-and-forget background tasks.

`asyncio.create_task()` results must be kept referenced somewhere, or the task
is eligible for garbage collection mid-flight (see the asyncio docs' warning
on `create_task`). `track_task()` keeps a strong reference in a module-level
set until the task finishes.

`scrape_semaphore` caps how many Bilibili scrapes (`run_fetch`) can run at
once. Without it, two concurrent /api/fetch requests each spin up their own
BilibiliClient and, combined, double the effective request rate into
Bilibili's -799 risk control.
"""
import asyncio
import logging

logger = logging.getLogger(__name__)

_tasks: set[asyncio.Task] = set()

# Only one scrape (run_fetch) may run at a time, across all requests.
scrape_semaphore = asyncio.Semaphore(1)


def track_task(coro) -> asyncio.Task:
    """Create an asyncio task and keep a strong reference until it completes."""
    task = asyncio.create_task(coro)
    _tasks.add(task)

    def _on_done(t: asyncio.Task) -> None:
        _tasks.discard(t)
        if not t.cancelled() and t.exception() is not None:
            logger.error("Background task failed", exc_info=t.exception())

    task.add_done_callback(_on_done)
    return task
