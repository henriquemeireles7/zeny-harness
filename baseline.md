# Baseline

## Company
Zeny — open-source CLI tool that turns Claude Code into a self-learning autonomous
experiment engine for business operations.

## Mission
Help one-person companies and small teams use AI agents that actually learn and
improve over time — not just execute, but get better at executing.

## ICP (Ideal Customer Profile)
Solo developer or tiny team (1-3 people). Technically strong — can write code
but may not have deep ML expertise. Building AI-powered products or integrating
AI into existing workflows. Budget-conscious — uses personal Claude Code plan
rather than API keys. Values practical, actionable advice over theory.
Active on X/Twitter and follows AI agent discourse.

Cares about: shipping fast, learning in public, open source, sustainable
one-person businesses, AI agents that actually work (not demos).

Does NOT care about: enterprise sales, fundraising theater, hype cycles,
"thought leadership" that's just repackaged obvious takes.

## Problem
AI agents suck at long-running tasks because the harness is bad. You can't
just tell an AI "grow my business" and walk away. It forgets what it learned,
repeats mistakes, and has no way to measure whether it's improving.

## Old Solution
Manual prompting, multi-agent orchestration, or just doing everything yourself.
Copy-paste workflows. Hire freelancers. Use 10 different tools that don't talk
to each other.

## Why Old Solution Fails
- Manual prompting doesn't scale — you become the bottleneck
- Multi-agent orchestration multiplies entropy (scaling bad agents = more chaos)
- No feedback loop means no learning — each run starts from zero
- Business feedback is slow (24h+ to know if a tweet worked) so the agent can't iterate

## Negative Consequences of Staying
You stay as the bottleneck. Your content is inconsistent. You burn out trying
to do marketing + product + support. Your competitors who figure out AI-assisted
operations will outrun you. You never get the compound learning effect.

## New Solution
Zeny: a self-learning loop inspired by Karpathy's autoresearch. One agent, one
outcome, deep learning cycle. Simulated audience feedback (personas) gives instant
signal. The agent generates, simulates, scores, learns, and improves — on autopilot.
You just watch.

## Positive Consequences
Your content improves every cycle without you touching it. The agent learns what
works for YOUR audience. You get compound returns — each run builds on the last.
You focus on strategy while the agent handles execution. Your one-person company
operates like it has a content team.

## Benefits
- Zero API costs (uses your existing Claude Code subscription)
- Works locally on your machine — no cloud, no data leaving your laptop
- Open source — inspect, modify, extend everything
- Learns from simulated personas, not real users (no cold start problem)
- Value-first optimization — consciousness floor prevents harmful content

## Product
CLI tool. `bun run src/index.ts --seed content.md`. That's it.
5 default personas simulate your audience. Binary evals define what "good" means.
Each cycle: generate one targeted change, simulate reactions, score, keep or discard.
Session summary shows the learning curve and best version.

## Offer
Free and open source. Star the repo, try it on your own content, join the community.
If it works for you, share what you built with it.

## Voice & Tone
Direct, honest, technically grounded. No hype. Show don't tell. Lead with what
the reader can DO, not what they should THINK. Respect the reader's intelligence.
Talk like a builder to a builder.
