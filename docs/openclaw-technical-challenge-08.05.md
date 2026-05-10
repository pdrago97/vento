# Technical Challenge: Cross-Session Memory Synchronization in OpenClaw

**Role:** AI Engineer
**Estimated Duration:** 48 hours
**Difficulty:** Advanced

---

## Context

[OpenClaw](https://github.com/openclaw/openclaw) is an open-source AI agent framework that runs locally and connects to LLMs (Claude, ChatGPT, DeepSeek) to execute tasks autonomously. It supports 22+ messaging platforms — WhatsApp, Slack, Telegram, Discord, Teams, and more — through dedicated channel adapters.

Sessions across all channels already share a single `memory.md` file on disk — a flat Markdown file where the assistant persists long-term facts about the user. However, **each session maintains its own independent conversation context** — the rolling window of messages that gets sent to the LLM on every turn.

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  WhatsApp    │     │    Slack     │     │   Telegram   │
│   Session    │     │   Session    │     │   Session    │
│              │     │              │     │              │
│  [context A] │     │  [context B] │     │  [context C] │
│              │     │              │     │              │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       └────────────────────┼────────────────────┘
                            │
                   ┌────────────────┐
                   │  memory.md     │
                   │  (shared disk) │
                   └────────────────┘
```

### The Problem

The shared `memory.md` is not enough. Not everything the user says gets written there — nor should it. Writing every piece of information to `memory.md` and then loading it into every session's context would be both **expensive** (more tokens sent to the LLM on every turn = higher cost and latency) and **noisy** (irrelevant details polluting the context window).

The real problem is that **session contexts are isolated**. If a user tells their assistant on WhatsApp "My meeting with Acme Corp was moved to Thursday," that information lives only in the WhatsApp session's context. When the user later asks on Slack "When is my Acme Corp meeting?", the Slack session has no idea — the information never reached it. The user is forced to repeat themselves, and the assistant feels broken.

A naive solution — merging all session contexts into one — doesn't work. Each LLM call already has a token budget. Dumping the full conversation history from every channel into every session would explode costs, degrade performance, and hit context window limits fast.

**Your job is to solve this.** You need to make OpenClaw share relevant knowledge between sessions in near real-time, without requiring a unified context and without making every LLM call absurdly expensive. How you get there is entirely up to you — you might achieve this through OpenClaw's existing configuration and tools, by writing a plugin or skill, or by modifying the core codebase. The approach is your decision, and we want to understand why you chose it.

---

## Part 1 — Architecture & Implementation (60 minutes)

### Requirements

Your solution must satisfy these hard constraints:

- **No unified context.** Sessions cannot share a single conversation context. Each session must manage its own context window independently. This is a cost and performance constraint — every token in the context is money and latency.
- **Near real-time.** Information shared on one channel must be available to other sessions within seconds, not on the next restart or after a manual sync.
- **Conflict resolution.** If the user says "My favorite color is blue" on WhatsApp and then "My favorite color is green" on Slack 10 seconds later, the system must handle this gracefully. Perfect consistency is not required, but the behavior must be reasonable and explainable.
- **Selective propagation.** Not everything should be shared. A casual "lol" on Discord should not pollute the context on Slack. Your solution must distinguish meaningful knowledge from noise.

Beyond these constraints, the design is yours. We are not looking for a specific answer — we want to see how you think.

### Deliverables

1. **Architecture document** — Explain your approach. Include a diagram showing how sessions communicate, what gets propagated, and how conflicts are resolved. Justify your choices — why this approach over the alternatives? What are the cost implications?

2. **Working solution** — Make it work on OpenClaw. Whether you achieve this through configuration, an OpenClaw skill/plugin, a fork with code changes, or a combination — that's your call. We want to see something we can run, not a slide deck. Specifically:
   - How knowledge moves from one session context to another
   - Where and how your solution integrates with OpenClaw
   - How conflicts between sessions are handled
   - How you control what gets propagated vs. what stays local to a session

3. **Tests** — Write tests that demonstrate your solution works. At minimum, cover:
   - A fact shared on one session becomes available on another
   - Conflicting updates are resolved gracefully
   - Noise/ephemeral messages are not propagated

You will be asked to **walk through your solution and defend your decisions** in a follow-up conversation.

---

## Part 2 — Discussion Questions (30 minutes)

Answer the following questions in writing. We value depth of thought, awareness of trade-offs, and practical engineering judgment over length.

### 2.1 — Alternatives to OpenClaw

If you were **not** going to use OpenClaw as the core of this solution, what would you use instead? Consider frameworks, platforms, or building from scratch. Compare your alternative against OpenClaw on:

- Extensibility and plugin ecosystem
- Multi-channel messaging support
- Local-first vs. cloud-first trade-offs
- Community maturity and long-term viability

### 2.2 — Advantages and Disadvantages of OpenClaw

Provide a balanced analysis of using OpenClaw as the foundation for a production system:

- What are its strongest architectural decisions?
- Where does it fall short?
- What risks does relying on it introduce (licensing, community governance, security)?
- How does its "no vector database, no orchestration framework" philosophy help or hinder the cross-session memory problem you just solved?

### 2.3 — Maintaining a Custom Fork

This is a real-world maintenance problem. Regardless of how you implemented your solution — configuration, plugin, or code modification — OpenClaw upstream will keep releasing updates: new features, security patches, breaking refactors.

Describe your strategy for:

- Keeping your solution compatible with upstream releases
- Minimizing the risk of upstream changes breaking your sync layer
- Testing compatibility as OpenClaw evolves
- Deciding when to contribute changes back upstream vs. maintaining them separately

Be specific — mention concrete tools, branching strategies, CI/CD patterns, or architectural patterns (adapter pattern, middleware injection, etc.) that would make this sustainable.

---

## Evaluation Criteria

| Criteria | Weight | What We're Looking For |
|---|---|---|
| **Working Solution** | 35% | Does it actually solve the problem? Can we run it? Does it respect the constraints? |
| **Architecture Quality** | 25% | Clean separation of concerns, awareness of distributed systems fundamentals, good abstractions |
| **Practical Judgment** | 20% | Realistic trade-offs, awareness of edge cases, production-readiness, ability to defend decisions under questioning |
| **Discussion Depth** | 10% | Thoughtful analysis of alternatives, honest assessment of trade-offs, concrete maintenance strategy |
| **Communication** | 10% | Clear writing, well-structured arguments, readable code |

---

## Submission Guidelines

1. Submit your architecture document and discussion answers as Markdown or PDF
2. Submit your solution in a way we can run it — a fork, a plugin, a config bundle, or whatever fits your approach. We should be able to reproduce your results.
3. Include a README explaining how to set up and test your solution
4. Be prepared to walk through your solution and defend every decision in a follow-up conversation

**Note:** You are free to use AI tools to assist you, but you must be able to explain every design decision and line of code. We will ask pointed follow-up questions — if you can't defend it, it doesn't count.

---

*We're hiring engineers who solve problems, not engineers who draw diagrams about solving problems.*
