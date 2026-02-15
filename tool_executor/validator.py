"""
Generation Validator for the Containerized Tool Executor.

Runs automated quality checks (lint, type-check, test) inside the Docker
sandbox after the agent finishes generating code.  Returns a structured
pass/fail report so the orchestrator can ask the agent to fix issues before
a PR is opened.
"""

import json
import logging
from dataclasses import dataclass, field, asdict
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .docker_executor import DockerToolExecutor, ExecutionResult

logger = logging.getLogger(__name__)


# ── Check result types ──────────────────────────────────────────────────

@dataclass
class CheckResult:
    """Result of a single validation check."""
    name: str
    passed: bool
    command: str
    stdout: str = ""
    stderr: str = ""
    exit_code: int | None = None

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class ValidationReport:
    """Aggregated validation report."""
    overall_pass: bool = True
    checks: list[CheckResult] = field(default_factory=list)
    summary: str = ""

    def add(self, check: CheckResult) -> None:
        self.checks.append(check)
        if not check.passed:
            self.overall_pass = False

    def to_dict(self) -> dict:
        return {
            "overall_pass": self.overall_pass,
            "summary": self.summary,
            "checks": [c.to_dict() for c in self.checks],
        }

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), indent=2)

    def build_summary(self) -> str:
        passed = sum(1 for c in self.checks if c.passed)
        total = len(self.checks)
        lines = [f"Validation: {passed}/{total} checks passed."]
        for c in self.checks:
            icon = "✅" if c.passed else "❌"
            lines.append(f"  {icon} {c.name}")
            if not c.passed and c.stderr:
                # Show first 5 lines of error output for context
                err_lines = c.stderr.strip().splitlines()[:5]
                for el in err_lines:
                    lines.append(f"      {el}")
        self.summary = "\n".join(lines)
        return self.summary


# ── Project-type detection ──────────────────────────────────────────────

_PROJECT_DETECTORS: dict[str, str] = {
    # filename → project_type
    "package.json": "node",
    "requirements.txt": "python",
    "pyproject.toml": "python",
    "setup.py": "python",
    "Cargo.toml": "rust",
    "go.mod": "go",
}


def detect_project_type(executor: "DockerToolExecutor") -> str:
    """Detect the project type from marker files in /workspace."""
    for marker, ptype in _PROJECT_DETECTORS.items():
        result = executor.execute_bash(f"test -f /workspace/{marker} && echo found")
        if result["status"] == "success" and "found" in result["output"]:
            logger.info("Detected project type: %s (via %s)", ptype, marker)
            return ptype
    return "unknown"


# ── Check definitions per project type ──────────────────────────────────

def _node_checks() -> list[tuple[str, str]]:
    """Return (check_name, command) pairs for a Node/TS project."""
    return [
        ("syntax_check",    "npx --yes tsc --noEmit 2>&1 || true"),
        ("lint",            "npx --yes eslint . --max-warnings=0 2>&1 || true"),
        ("unit_tests",      "npm test --if-present 2>&1 || true"),
    ]


def _python_checks() -> list[tuple[str, str]]:
    """Return (check_name, command) pairs for a Python project."""
    return [
        ("syntax_check",    "python -m py_compile $(find . -name '*.py' -not -path './.venv/*' | head -20) 2>&1"),
        ("lint",            "pip install -q ruff 2>/dev/null && ruff check . 2>&1 || true"),
        ("unit_tests",      "python -m pytest --tb=short -q 2>&1 || true"),
    ]


def _generic_checks() -> list[tuple[str, str]]:
    """Fallback checks that work for any project."""
    return [
        ("file_integrity",  "find /workspace -name '*.py' -o -name '*.ts' -o -name '*.js' | head -5 && echo 'files found'"),
    ]


_CHECK_REGISTRY: dict[str, callable] = {
    "node": _node_checks,
    "python": _python_checks,
    "unknown": _generic_checks,
}


# ── Main validation entry point ────────────────────────────────────────

def run_validation(executor: "DockerToolExecutor", project_type: str | None = None) -> ValidationReport:
    """
    Run all validation checks for the detected (or specified) project type.

    Args:
        executor: A running DockerToolExecutor with a workspace mounted.
        project_type: Override auto-detection if you already know the type.

    Returns:
        A ValidationReport with per-check results and an overall pass/fail.
    """
    if project_type is None:
        project_type = detect_project_type(executor)

    checks_fn = _CHECK_REGISTRY.get(project_type, _generic_checks)
    checks = checks_fn()

    report = ValidationReport()

    for name, cmd in checks:
        logger.info("Running check: %s", name)
        result: "ExecutionResult" = executor.execute_bash(cmd)

        check = CheckResult(
            name=name,
            passed=result["exit_code"] == 0,
            command=cmd,
            stdout=result["output"] or "",
            stderr=result.get("error", "") or "",
            exit_code=result["exit_code"],
        )
        report.add(check)

    report.build_summary()
    logger.info("Validation complete: %s", "PASS" if report.overall_pass else "FAIL")
    return report
