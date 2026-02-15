"""
Token counting utilities with tiktoken primary + character fallback.
"""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from google.genai import types

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Tiktoken setup (lazy‑loaded so import is never fatal)
# ---------------------------------------------------------------------------
_encoder = None
_USE_TIKTOKEN = True


def _get_encoder():
    """Lazily load the tiktoken encoder, falling back gracefully."""
    global _encoder, _USE_TIKTOKEN
    if _encoder is not None:
        return _encoder
    try:
        import tiktoken
        _encoder = tiktoken.get_encoding("cl100k_base")
        return _encoder
    except Exception as exc:
        logger.warning("tiktoken unavailable, using char heuristic: %s", exc)
        _USE_TIKTOKEN = False
        return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def _text_from_content(content: "types.Content") -> str:
    """Extract all text from a Content object."""
    parts = []
    if content.parts:
        for part in content.parts:
            if hasattr(part, "text") and part.text:
                parts.append(part.text)
            elif hasattr(part, "function_call") and part.function_call:
                parts.append(
                    f"function_call:{part.function_call.name}("
                    f"{part.function_call.args})"
                )
            elif hasattr(part, "function_response") and part.function_response:
                parts.append(
                    f"function_response:{part.function_response.name}="
                    f"{part.function_response.response}"
                )
    return "\n".join(parts)


def count_tokens_text(text: str) -> int:
    """Count tokens in a plain string."""
    enc = _get_encoder()
    if enc is not None:
        try:
            return len(enc.encode(text))
        except Exception:
            pass
    # Fallback: ~4 chars per token
    return max(1, len(text) // 4)


def count_tokens(messages: list["types.Content"]) -> int:
    """
    Count total tokens across a list of Content messages.

    Uses tiktoken (cl100k_base) when available, otherwise falls back
    to a character‑based heuristic (1 token ≈ 4 characters).
    """
    total = 0
    for msg in messages:
        text = _text_from_content(msg)
        total += count_tokens_text(text)
        # Small overhead per message for role / structure tokens
        total += 4
    return total


def split_at_token_boundary(
    messages: list["types.Content"],
    target_head_tokens: int,
) -> tuple[list["types.Content"], list["types.Content"]]:
    """
    Split *messages* into (head, tail) where head contains approximately
    *target_head_tokens* tokens.

    The split always happens at a message boundary (never mid‑message).
    """
    running = 0
    split_idx = 0
    for i, msg in enumerate(messages):
        msg_tokens = count_tokens_text(_text_from_content(msg)) + 4
        if running + msg_tokens > target_head_tokens:
            split_idx = i
            break
        running += msg_tokens
    else:
        # All messages fit within target — everything is head
        return list(messages), []

    return list(messages[:split_idx]), list(messages[split_idx:])
