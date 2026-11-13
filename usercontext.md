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