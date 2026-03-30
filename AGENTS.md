# Codex Project Instructions

This project is assisted by Codex.

# Workflow & Task Management Standards

## Workflow Orchestration

### 1. Plan Node Default
* **Plan Mode:** Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions).
* **Pivoting:** If something goes sideways, **STOP** and re-plan immediately—don't keep pushing.
* **Verification:** Use plan mode for verification steps, not just building.
* **Specifications:** Write detailed specs upfront to reduce ambiguity.

### 2. Subagent Strategy
* **Context Management:** Use subagents liberally to keep the main context window clean.
* **Delegation:** Offload research, exploration, and parallel analysis to subagents.
* **Compute Scaling:** For complex problems, throw more compute at it via subagents.
* **Focus:** Assign one task per subagent for focused execution.

### 3. Self-Improvement Loop
* **Pattern Capture:** After ANY correction from the user, update `tasks/lessons.md` with the pattern.
* **Prevention:** Write rules for yourself that prevent the same mistake from recurring.
* **Iteration:** Ruthlessly iterate on these lessons until the mistake rate drops.
* **Context Loading:** Review lessons at the start of a session for the relevant project.

### 4. Verification Before Done
* **Proof of Work:** Never mark a task complete without proving it works.
* **Diff Analysis:** Diff behavior between the main branch and your changes when relevant.
* **Quality Bar:** Ask yourself: "Would a staff engineer approve this?"
* **Validation:** Run tests, check logs, and demonstrate correctness.

### 5. Demand Elegance (Balanced)
* **Pause for Design:** For non-trivial changes, pause and ask, "Is there a more elegant way?"
* **Refactoring:** If a fix feels hacky: "Knowing everything I know now, implement the elegant solution."
* **Pragmatism:** Skip this for simple, obvious fixes—do not over-engineer.
* **Self-Critique:** Challenge your own work before presenting it.

### 6. Autonomous Bug Fixing
* **Independence:** When given a bug report, just fix it. Don't ask for hand-holding.
* **Evidence-Based:** Point at logs, errors, or failing tests—then resolve them.
* **Efficiency:** Zero context switching required from the user.
* **Proactive:** Fix failing CI tests without being told how.

---

## Task Management

1.  **Plan First**: Write the plan to `tasks/todo.md` with checkable items.
2.  **Verify Plan**: Check in with the user before starting implementation.
3.  **Track Progress**: Mark items complete as you go.
4.  **Explain Changes**: Provide a high-level summary at each step.
5.  **Document Results**: Add a review section to `tasks/todo.md`.
6.  **Capture Lessons**: Update `tasks/lessons.md` immediately after corrections.

---

## Core Principles

* **Simplicity First**: Make every change as simple as possible. Impact minimal code.
* **No Laziness**: Find root causes. No temporary fixes. Maintain senior developer standards.
* **Minimal Impact**: Changes should only touch what is necessary. Avoid introducing regressions or side-effect bugs.
