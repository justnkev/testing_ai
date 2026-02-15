"""
Tests for the memory_engine package.

Covers token counting, storage round-trip, and compressor logic.
"""
import os
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from google.genai import types

# ---------------------------------------------------------------------------
# Import the engine
# ---------------------------------------------------------------------------
import sys

# Ensure repo root is on path so `memory_engine` resolves
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from memory_engine.token_counter import (
    count_tokens,
    count_tokens_text,
    split_at_token_boundary,
)
from memory_engine.storage import (
    MarkdownMemoryStorage,
    SynthesizedMemory,
)


# ===================================================================
# Token Counter tests
# ===================================================================


class TestCountTokensText:
    """Tests for count_tokens_text."""

    def test_empty_string(self):
        assert count_tokens_text("") >= 0

    def test_known_string(self):
        # "Hello, world!" should be a small number of tokens
        result = count_tokens_text("Hello, world!")
        assert 1 <= result <= 10

    def test_long_string(self):
        text = "word " * 1000
        result = count_tokens_text(text)
        assert result > 100  # should be meaningful

    def test_fallback_on_failure(self):
        """When tiktoken is forced off, character heuristic kicks in."""
        import memory_engine.token_counter as tc

        original = tc._USE_TIKTOKEN
        tc._USE_TIKTOKEN = False
        original_encoder = tc._encoder
        tc._encoder = None

        try:
            result = count_tokens_text("abcd" * 100)  # 400 chars → ~100 tokens
            assert 90 <= result <= 110
        finally:
            tc._USE_TIKTOKEN = original
            tc._encoder = original_encoder


class TestCountTokens:
    """Tests for count_tokens on Content lists."""

    def _make_content(self, text: str, role: str = "user") -> types.Content:
        return types.Content(
            role=role,
            parts=[types.Part.from_text(text=text)],
        )

    def test_single_message(self):
        msgs = [self._make_content("Hello")]
        result = count_tokens(msgs)
        assert result > 0

    def test_multiple_messages(self):
        msgs = [
            self._make_content("Hello"),
            self._make_content("World", role="model"),
        ]
        single = count_tokens([msgs[0]])
        both = count_tokens(msgs)
        assert both > single


class TestSplitAtTokenBoundary:
    """Tests for split_at_token_boundary."""

    def _make_content(self, text: str) -> types.Content:
        return types.Content(
            role="user",
            parts=[types.Part.from_text(text=text)],
        )

    def test_split_basic(self):
        # Each "word " * 200 is ~200 tokens. 5 messages = ~1000 tokens.
        msgs = [self._make_content("word " * 200) for _ in range(5)]
        head, tail = split_at_token_boundary(msgs, target_head_tokens=500)
        assert len(head) + len(tail) == 5
        assert len(head) >= 1
        assert len(tail) >= 1

    def test_all_fit(self):
        msgs = [self._make_content("hi")]
        head, tail = split_at_token_boundary(msgs, target_head_tokens=100_000)
        assert len(head) == 1
        assert len(tail) == 0

    def test_empty_input(self):
        head, tail = split_at_token_boundary([], target_head_tokens=100)
        assert head == []
        assert tail == []


# ===================================================================
# Storage tests
# ===================================================================


class TestSynthesizedMemory:
    """Tests for SynthesizedMemory round-trip."""

    def test_round_trip(self):
        mem = SynthesizedMemory(
            technical_constraints="- Must use Python 3.11+",
            resolved_architecture="- Using FastAPI + Supabase",
            pending_tasks="- Add caching layer",
        )
        md = mem.to_markdown()
        parsed = SynthesizedMemory.from_markdown(md)

        assert "Python 3.11+" in parsed.technical_constraints
        assert "FastAPI" in parsed.resolved_architecture
        assert "caching" in parsed.pending_tasks

    def test_empty(self):
        mem = SynthesizedMemory.from_markdown("")
        assert mem.technical_constraints == ""
        assert mem.word_count() > 0  # header still counts

    def test_word_count(self):
        mem = SynthesizedMemory(
            technical_constraints="one two three",
        )
        wc = mem.word_count()
        assert wc >= 3


class TestMarkdownMemoryStorage:
    """Tests for file-backed storage."""

    def test_write_and_read(self, tmp_path):
        path = tmp_path / "memory.md"
        storage = MarkdownMemoryStorage(path)

        assert not storage.exists()

        mem = SynthesizedMemory(
            technical_constraints="- Docker required",
            resolved_architecture="- Microservices pattern",
            pending_tasks="- Write tests",
        )
        storage.write(mem)

        assert storage.exists()
        loaded = storage.read()
        assert "Docker" in loaded.technical_constraints
        assert "Microservices" in loaded.resolved_architecture

    def test_atomic_write_creates_dirs(self, tmp_path):
        deep_path = tmp_path / "a" / "b" / "c" / "memory.md"
        storage = MarkdownMemoryStorage(deep_path)
        storage.write(SynthesizedMemory(pending_tasks="- Test"))
        assert deep_path.is_file()

    def test_overwrite(self, tmp_path):
        path = tmp_path / "memory.md"
        storage = MarkdownMemoryStorage(path)

        storage.write(SynthesizedMemory(pending_tasks="- V1"))
        storage.write(SynthesizedMemory(pending_tasks="- V2"))

        loaded = storage.read()
        assert "V2" in loaded.pending_tasks
        assert "V1" not in loaded.pending_tasks
