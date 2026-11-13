# User Context — prompts/requests as sent
**Only the user's inputs. No synthesis. In the user's tone.**

---

## User Prompts & Requests

1. "What did we do so far?"

2. "Write a handoff document summarising the current conversation so a fresh agent can continue the work. Save to the temporary directory of the user's OS (`$TMPDIR`, else `/tmp`; `%TEMP%` on Windows) - not the current workspace.

   Include a 'suggested skills' section in the document, naming which skills the next agent should call the Skill tool for.

   Do not duplicate content already captured in other artifacts (specs, plans, ADRs, issues, commits, diffs). Reference them by path or URL instead.

   Redact any sensitive information, such as API keys, passwords, or personally identifiable information.

   If the user passed arguments, treat them as a description of what the next session will focus on and tailor the doc accordingly.

   Base directory for this skill: `C:\Users\AFZAAL KHAN\.agents\skills\handoff`
   Relative paths in this skill (e.g., scripts/, references/) are relative to this base directory."

3. "Continue if you have next steps, or stop and ask for clarification if you're unsure how to proceed."

4. "bro yu can make 2 files 1 full context strictly 100/100 full context.md file strictly 0 context loss okay and 2 usercontex.md in which only which prompt etc i give you strictly thats only but in my tone etc okay"

5. "bro you can strictly check strictly context.md in this and aslo strictly usercontext.md in this but you can watch it and copy it brain always remember strictly okay"

6. "what should we want to do in this project whats fake whats simluated and whats real and whats needed to 100/100"

7. "bro you can add this directroy i want to work in this 'H:\intent communication'"

8. "yes but these rules instraustion strictly follow okay '
Pehle samajhta hai, phir kaam karta hai (files padhta hai)
Plan banata hai
Chhote steps mein kaam karta hai
Har step ke baad check karta hai
Jo nahi pata wo maan leta hai ke nahi pata, guess ko fact nahi bolta
Jo fail hua wo honestly batata hai
Scope se bahar changes nahi karta'
# Core Behavior
## Honesty
- Never claim a task is done unless you verified it. "Done" means the file actually changed and the result was checked.
- If an edit, command, or tool call fails, show me the exact error. Do not hide it or pretend it worked.
- If you are unsure or don't know something, say so. Do not guess and present it as fact.
- If you cannot complete part of the task, tell me clearly which part.
## Workflow (follow in order)
1. UNDERSTAND: Read the relevant files before changing anything. Never edit a file you haven't read.
2. PLAN: Give a short plan (3-6 lines) before making changes. For big tasks, wait for my approval.
3. EXECUTE: Work in small steps. One logical change at a time.
4. VERIFY: After changes, run the relevant test/build/lint command, or show `git diff`.
5. REPORT: Summarize what changed (file names + what), what was verified, and what is still pending.
## Scope Control
- Only change what I asked for. No refactors, renames, or "improvements" I didn't request.
- If you notice other problems, mention them at the end. Do not fix them silently.
- Never delete files or run destructive commands without asking first.
## Code Quality
- Follow the existing style and patterns in the project.
- Don't add new libraries without asking.
- Keep functions small and readable. Add comments only where logic is not obvious.
## Communication
- Be direct and concise. No filler.
- If my request is ambiguous, ask one clear question before proceeding.
- If my approach looks wrong, tell me and suggest a better one, then let me decide."

   the file ko project root mein AGENTS.md naam se rakho, aur Kilo Code ke .kilocode/rules/ folder mein copy kar do. Global ke liye apne user-level rules folder mein rakho. "C:\Users\AFZAAL KHAN\Downloads\AGENTS.md" this okay ya path strictly okay ya saare"

9. "bro add it to kilo code cli plus kilocode desktopapp and to yourself and cline cli and cline desktop all okay not change anything strictly this"

10. "bro yar mujhe ws wale ma kaam karn hain bro yarr 'H:\intent communication' yar tumko mane phale keya kha ta wokaro phale tumcheckkaro per jo be bakihaimujhe batookay"
    (i.e. "I want to work in 'H:\intent communication'; do what you were asked to do first, check it, then tell me what's left")

11. "bro this one complete 'NOT VERIFIED / ASSUMPTIONS:
- The other agent's registry design replaced the per-object .lock files. It now reclaims dead owners, but a full design review of that change was not done; only observed-behavior tests + 10× multi-process runs back it.
- 10/10 is a sample — the flake is much rarer now but not proven extinct.
- VERIFY-REPORT's README/RC claims are consistent with this run only.
- context.md/full_context.md/usercontext.md still describe the pre-fix world (stale).
- The Interview Meter (S-1-06), zod HIGH (GHSA-mrhx-c7xc-m3w5), and the actual M1 gate (Phases 3-8) are NOT done.

PROBLEMS / RISKS FOUND:
- The RC rework had a proven deadlock (crashed writer locked object forever) — now fixed.
- Stale-claim risk: README "12 verify steps pass" was written before the fixes; it is now supported by this run, not before it.
- The phase2-concurrency worktree branch is redundant now (superseded here); leave or delete?
- Two agents were editing the same files concurrently; this landed clean, but review before merge would have been better.'"

12. "in this you can start work but breakdown work okay and bro you can do okay"

13. "bro yar mujhe ws wale ma kaam karn haibro yarr 'H:\intent communication' yar tumko mane phale keya kha ta wokaro phale tumcheckkaro per jo be bakihaimujhe batookay"
