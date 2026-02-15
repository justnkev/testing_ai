"""
MemoryCompressor — rolling‑summary engine for long conversations.

Monitors token count, flushes old history into structured memory,
and rebuilds the system prompt with persisted context.
"""
from __future__ import annotations

import logging
from typing import Any

from google import genai
from google.genai import types

from .storage import MemoryStorage, SynthesizedMemory
from .token_counter import count_tokens, count_tokens_text, split_at_token_boundary

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Synthesis prompt
# ---------------------------------------------------------------------------

SYNTHESIS_PROMPT = """\
You are a Memory Synthesis Engine.  Your job is to produce a structured,
**merged** summary that combines NEW conversation history with EXISTING
project memory.  Follow these rules strictly:

1. **Merge, don't overwrite.**  If the existing memory already documents a
   decision or constraint, keep it — even if the new history doesn't mention
   it.  Only remove information that the new history explicitly invalidates.
2. **Be concise.**  The output must be ≤ 5 000 words.  Prioritize technical
   decisions, architecture choices, unresolved tasks, and key constraints.
3. **Use exactly these three sections** (omit a section only if truly empty):

   ## Technical Constraints
   Hard limits, env requirements, security rules, API quotas, etc.

   ## Resolved Architecture
   Decisions that have been made: patterns chosen, libraries picked,
   schema designs, integration points, file layouts, etc.

   ## Pending Tasks
   Open work items, known bugs, or unanswered questions.

4. Use bullet points for readability.  Include code snippets only when they
   capture a critical pattern (< 10 lines each).
5. Do NOT invent information.  Only summarize what is present in the inputs.

---

### EXISTING MEMORY (may be empty on first run)

{existing_memory}

---

### NEW CONVERSATION HISTORY TO INCORPORATE

{new_history}
"""

RECURSIVE_SUMMARY_PROMPT = """\
The following summary is too long ({word_count} words, limit is {max_words}).
Condense it to ≤ {max_words} words while preserving all critical technical
decisions and pending tasks.  Keep the same three‑section structure
(## Technical Constraints, ## Resolved Architecture, ## Pending Tasks).

{summary}
"""


# ---------------------------------------------------------------------------
# Compressor class
# ---------------------------------------------------------------------------


class MemoryCompressor:
    """
    Monitors conversation token weight and flushes old history into
    a persistent, structured memory file via LLM synthesis.

    Parameters
    ----------
    client : genai.Client
        Authenticated Gemini client.
    storage : MemoryStorage
        Backend for reading/writing the synthesized memory.
    threshold : int
        Token count at which compression fires (default 100 000).
    head_ratio : float
        Fraction of tokens to flush (oldest); the rest are kept as raw
        active context (default 0.8 → flush 80k, keep 20k).
    model_name : str
        Model used for synthesis calls (default gemini-2.5-flash).
    max_words : int
        Hard cap on the memory file word count (default 5 000).
    """

    def __init__(
        self,
        client: genai.Client,
        storage: MemoryStorage,
        *,
        threshold: int = 100_000,
        head_ratio: float = 0.8,
        model_name: str = "gemini-2.5-flash",
        max_words: int = 5_000,
    ):
        self.client = client
        self.storage = storage
        self.threshold = threshold
        self.head_ratio = head_ratio
        self.model_name = model_name
        self.max_words = max_words

        # Running stats
        self._last_token_count: int = 0
        self._compression_count: int = 0

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    @property
    def last_token_count(self) -> int:
        """Token count as of the most recent check."""
        return self._last_token_count

    @property
    def compression_count(self) -> int:
        """How many times compression has fired this session."""
        return self._compression_count

    def check_and_compress(
        self,
        history: list[types.Content],
    ) -> list[types.Content]:
        """
        Check the token weight of *history*.  If it exceeds the threshold,
        flush the oldest portion into persistent memory and return the
        trimmed tail.  Otherwise return *history* unchanged.
        """
        self._last_token_count = count_tokens(history)
        logger.info(
            "Token check: %d / %d (%.0f%%)",
            self._last_token_count,
            self.threshold,
            self._last_token_count / self.threshold * 100,
        )

        if self._last_token_count <= self.threshold:
            return history

        # --- Compression needed ---
        head_target = int(self.threshold * self.head_ratio)
        head, tail = split_at_token_boundary(history, head_target)

        if not head:
            logger.warning("Nothing to flush — head is empty after split.")
            return history

        logger.info(
            "Compressing: flushing %d messages (%d head tokens), "
            "keeping %d messages as raw context.",
            len(head),
            count_tokens(head),
            len(tail),
        )

        # Read existing memory
        existing = self.storage.read()

        # Synthesize
        synthesized_text = self._synthesize(head, existing)
        new_memory = SynthesizedMemory.from_markdown(synthesized_text)

        # Enforce word limit (recursive summarization)
        new_memory = self._enforce_word_limit(new_memory)

        # Persist
        self.storage.write(new_memory)
        self._compression_count += 1

        # Update count for the trimmed tail
        self._last_token_count = count_tokens(tail)
        return tail

    def build_system_prompt(self, base_instruction: str) -> str:
        """
        Reconstruct the agent system prompt by prepending persisted
        memory (if any) before the base instruction.
        """
        if not self.storage.exists():
            return base_instruction

        memory = self.storage.read()
        memory_text = memory.to_markdown()
        if not memory_text.strip():
            return base_instruction

        return (
            "# Persistent Project Memory\n"
            "The following is a synthesized summary of earlier conversation "
            "context that has been compressed to save token space.  Treat it "
            "as reliable background knowledge.\n\n"
            f"{memory_text}\n\n"
            "---\n\n"
            f"{base_instruction}"
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _synthesize(
        self,
        head: list[types.Content],
        existing: SynthesizedMemory,
    ) -> str:
        """Call Gemini to merge old history into existing memory."""
        # Serialize head messages into readable text
        history_lines: list[str] = []
        for msg in head:
            role = msg.role or "unknown"
            parts_text: list[str] = []
            if msg.parts:
                for part in msg.parts:
                    if hasattr(part, "text") and part.text:
                        parts_text.append(part.text)
                    elif hasattr(part, "function_call") and part.function_call:
                        parts_text.append(
                            f"[tool_call: {part.function_call.name}("
                            f"{part.function_call.args})]"
                        )
                    elif hasattr(part, "function_response") and part.function_response:
                        resp = str(part.function_response.response)
                        if len(resp) > 500:
                            resp = resp[:500] + "…"
                        parts_text.append(
                            f"[tool_result: {part.function_response.name} → {resp}]"
                        )
            history_lines.append(f"**{role}**: {' | '.join(parts_text)}")

        prompt = SYNTHESIS_PROMPT.format(
            existing_memory=existing.to_markdown() if existing.word_count() > 5 else "(empty)",
            new_history="\n\n".join(history_lines),
        )

        response = self.client.models.generate_content(
            model=self.model_name,
            contents=[types.Content(role="user", parts=[types.Part.from_text(text=prompt)])],
            config=types.GenerateContentConfig(
                temperature=0.2,
                max_output_tokens=4096,
            ),
        )

        return response.text or ""

    def _enforce_word_limit(
        self,
        memory: SynthesizedMemory,
        depth: int = 0,
        max_depth: int = 3,
    ) -> SynthesizedMemory:
        """Recursively summarize if the memory exceeds the word cap."""
        wc = memory.word_count()
        if wc <= self.max_words:
            return memory

        if depth >= max_depth:
            logger.warning(
                "Recursive summary depth %d reached — truncating to %d words.",
                depth,
                self.max_words,
            )
            # Hard truncate as last resort
            words = memory.to_markdown().split()
            truncated = " ".join(words[: self.max_words])
            return SynthesizedMemory.from_markdown(truncated)

        logger.info(
            "Memory too long (%d words > %d). Recursive summarization depth=%d.",
            wc,
            self.max_words,
            depth + 1,
        )

        prompt = RECURSIVE_SUMMARY_PROMPT.format(
            word_count=wc,
            max_words=self.max_words,
            summary=memory.to_markdown(),
        )

        response = self.client.models.generate_content(
            model=self.model_name,
            contents=[types.Content(role="user", parts=[types.Part.from_text(text=prompt)])],
            config=types.GenerateContentConfig(
                temperature=0.1,
                max_output_tokens=4096,
            ),
        )

        condensed = SynthesizedMemory.from_markdown(response.text or "")
        return self._enforce_word_limit(condensed, depth + 1, max_depth)
