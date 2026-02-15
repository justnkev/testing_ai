"""
Abstract and concrete storage backends for synthesized memory.
"""
from __future__ import annotations

import logging
import os
import tempfile
import threading
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------

SECTION_HEADERS = [
    "## Technical Constraints",
    "## Resolved Architecture",
    "## Pending Tasks",
]


@dataclass
class SynthesizedMemory:
    """Structured representation of the persisted memory file."""

    technical_constraints: str = ""
    resolved_architecture: str = ""
    pending_tasks: str = ""
    raw_extra: str = ""  # catch‑all for content outside known sections

    def to_markdown(self) -> str:
        """Serialize to a well‑structured markdown string."""
        sections: list[str] = ["# Project Memory\n"]
        if self.technical_constraints:
            sections.append(f"## Technical Constraints\n\n{self.technical_constraints}\n")
        if self.resolved_architecture:
            sections.append(f"## Resolved Architecture\n\n{self.resolved_architecture}\n")
        if self.pending_tasks:
            sections.append(f"## Pending Tasks\n\n{self.pending_tasks}\n")
        if self.raw_extra:
            sections.append(f"## Additional Context\n\n{self.raw_extra}\n")
        return "\n".join(sections)

    @staticmethod
    def from_markdown(text: str) -> "SynthesizedMemory":
        """Parse a markdown string back into a SynthesizedMemory."""
        mem = SynthesizedMemory()
        if not text.strip():
            return mem

        current_section: str | None = None
        buffers: dict[str | None, list[str]] = {None: []}

        for line in text.splitlines():
            stripped = line.strip()
            if stripped == "## Technical Constraints":
                current_section = "technical_constraints"
                buffers.setdefault(current_section, [])
            elif stripped == "## Resolved Architecture":
                current_section = "resolved_architecture"
                buffers.setdefault(current_section, [])
            elif stripped == "## Pending Tasks":
                current_section = "pending_tasks"
                buffers.setdefault(current_section, [])
            elif stripped.startswith("## "):
                current_section = "raw_extra"
                buffers.setdefault(current_section, [])
                buffers[current_section].append(line)
            elif stripped.startswith("# "):
                # Top‑level header — skip
                continue
            else:
                buffers.setdefault(current_section, [])
                buffers[current_section].append(line)

        mem.technical_constraints = "\n".join(buffers.get("technical_constraints", [])).strip()
        mem.resolved_architecture = "\n".join(buffers.get("resolved_architecture", [])).strip()
        mem.pending_tasks = "\n".join(buffers.get("pending_tasks", [])).strip()
        mem.raw_extra = "\n".join(buffers.get("raw_extra", [])).strip()
        return mem

    def word_count(self) -> int:
        return len(self.to_markdown().split())


# ---------------------------------------------------------------------------
# Abstract storage interface
# ---------------------------------------------------------------------------


class MemoryStorage(ABC):
    """
    Abstract base so we can swap file‑backed storage for a DB later.
    """

    @abstractmethod
    def read(self) -> SynthesizedMemory:
        """Read the current persisted memory."""

    @abstractmethod
    def write(self, memory: SynthesizedMemory) -> None:
        """Overwrite the persisted memory atomically."""

    @abstractmethod
    def exists(self) -> bool:
        """Whether any persisted memory currently exists."""


# ---------------------------------------------------------------------------
# Markdown file implementation
# ---------------------------------------------------------------------------


class MarkdownMemoryStorage(MemoryStorage):
    """
    File‑backed storage that writes to a local .md file.

    Writes are atomic: content is flushed to a temp file in the same
    directory and then moved into place via ``os.replace``.
    """

    def __init__(self, path: str | Path):
        self._path = Path(path)
        self._lock = threading.Lock()

    @property
    def path(self) -> Path:
        return self._path

    def exists(self) -> bool:
        return self._path.is_file()

    def read(self) -> SynthesizedMemory:
        if not self._path.is_file():
            return SynthesizedMemory()
        text = self._path.read_text(encoding="utf-8")
        return SynthesizedMemory.from_markdown(text)

    def write(self, memory: SynthesizedMemory) -> None:
        """Atomic write: temp file → os.replace."""
        self._path.parent.mkdir(parents=True, exist_ok=True)
        md = memory.to_markdown()

        with self._lock:
            fd, tmp_path = tempfile.mkstemp(
                dir=str(self._path.parent),
                prefix=".memory_",
                suffix=".tmp",
            )
            try:
                with os.fdopen(fd, "w", encoding="utf-8") as f:
                    f.write(md)
                    f.flush()
                    os.fsync(f.fileno())
                os.replace(tmp_path, str(self._path))
                logger.info("Memory written to %s (%d words)", self._path, memory.word_count())
            except Exception:
                # Clean up temp file on failure
                if os.path.exists(tmp_path):
                    os.unlink(tmp_path)
                raise
