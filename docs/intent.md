# intent.md: Intent Interview and Profile Specification

Status: Draft v0.2 | Created: 2026-10-26 | Depends on: prd.md v0.2, design.md v0.2, architecture.md v0.2, trd.md v0.2, rules.md v0.2, context.md v0.2, memory.md v0.2

This document defines how the product understands what a user wants (Module A) and how it learns from the user over time. It is the normative spec for:

- the interview protocol, the question bank and the understanding meter,
- the summary and approval step,
- the derivation of the intent profile (resolves rules.md C-R2),
- the placement of the question bank (resolves context.md XQ5),
- the content of the canonical file `intent-core.md` (Appendix A).

Section numbers are stable anchors (context.md CX-08).

---

## 1. Purpose, Scope and Principles

Module A exists to close the intent gap before anything is built (PRD section 1). It is a protocol between an agent, the MCP server and the user. The agent supplies conversation and judgment. The server (`core`) supplies the question bank, the meter arithmetic, the evidence checks and the profile. **Nothing in `core` calls an AI** (PRD G3).

| ID | Principle |
|----|-----------|
| IP-01 | **Understand before building, in proportion.** Big or vague requests get an interview. Small or precise ones get none (rules R-R01) |
| IP-02 | **Ask less, learn more.** Never ask what the prompt, the scene, an earlier answer, the project or the profile already tells you |
| IP-03 | **Choosing beats typing.** Every question offers options. Typing is always allowed and never required |
| IP-04 | **Honest numbers.** The meter comes from evidence, can go down, and may end low. The user decides at the summary |
| IP-05 | **The user decides.** Delegated defaults are visible. Nothing is built before approval, unless the user skips |
| IP-06 | **Deterministic core, judging agent.** Bank, meter math, caps and profile rules live in code and are testable. Wording and judgment live with the agent |
| IP-07 | **Never ask what the product cannot act on yet.** Every seed carries the milestone from which it is useful |
| IP-08 | **Learning is local, visible and reversible.** The user can see, edit, delete and pause everything remembered |

## 2. The Intent Model

### 2.1 Slots

The intent of a task is a set of **slots**. A slot is one decision the product needs, named `<topic>.<name>`, for example `style.corner`. Each slot has a status.

| Status | Meaning | Meter value |
|--------|---------|-------------|
| unknown | Nothing is known | 0 |
| assumed | The agent chose, or the user delegated or skipped, or a remembered value is not yet confirmed | 0.5 |
| stated | The user said it (answer, or a quote from the prompt), or confirmed a remembered value | 1.0 |
| na | Clearly not applicable (for example no sign-in in a one-screen demo). Removed from the denominator | n/a |

Every slot also has a **source tag** for the summary: `prompt` (the user's message), `answer`, `remembered`, `delegated`.

### 2.2 Topics, weights and slots

Topics are the eight from trd 10.2. **Required** topics (trd 10.2 rule 2) are goal, users, screens, flow, style, content.

| Topic | Weight | Active from task size | Slots (tier) |
|-------|--------|----------------------|--------------|
| goal | 20 | small | `goal.purpose` P1, `goal.platform` P1, `goal.success` P2, `goal.protoUse` P2 |
| users | 10 | small | `users.primary` P1, `users.skill` P2, `users.a11y` P2, `users.context` P3 |
| screens | 20 | small | `screens.list` P1, `screens.nav` P1, `screens.auth` P2, `screens.start` P3 |
| flow | 15 | small | `flow.main` P1, `flow.after` P2, `flow.links` P2, `flow.back` P3 |
| style | 15 | small | `style.mood` P1, `style.palette` P1, `style.theme` P1, `style.density` P2, `style.corner` P2, `style.brand` P2, `style.heading` P3 |
| content | 10 | small | `content.tone` P1, `content.data` P1, `content.lang` P2, `content.images` P3, `content.name` P3 |
| behavior | 7 | medium | `behavior.states` P2, `behavior.forms` P2, `behavior.responsive` P2, `behavior.motion` P3 |
| edge-cases | 3 | large | `edge.empty` P3, `edge.long` P3, `edge.fail` P3 |

Each topic also has an `<topic>.other` slot for custom questions. It records evidence but does not enter the meter arithmetic.

**Tiers and task size.** A task of size small includes tier P1. Medium includes P1 and P2. Large includes P1, P2 and P3. A slot also needs its seed's `since` milestone to be reached (section 6.2).

| Size | Slots in scope (at M3) | Target questions (PRD FR-A6) | Soft cap (trd 10.2) |
|------|------------------------|------------------------------|---------------------|
| small | 11 | 8 | 12 |
| medium | 25 | 15 | 25 |
| large | 35 | 30 | 40 |

Targets are the lower ends of the PRD ranges. Soft caps are the upper ends. Prompt harvesting, remembered values and delegation mean fewer questions than slots are usually asked.

## 3. Interview Modes and Task Sizing

### 3.1 Modes

| Mode | When | What happens |
|------|------|--------------|
| **None** | Typos, bug fixes, renames, questions, precise small edits (R-R01) | No interview. Just do the task |
| **Full** | New UI, prototype or product design, or a vague build request | Section 4 protocol, all active topics |
| **Refine** | A scene exists and the approved brief exists (section 9.5), and the request changes part of it | `start` returns `carryOver`. Ask only about the topics the request touches. Others keep their approved values |
| **Quick** | The user asks to skip questions, or accepts the offer "build with my assumptions" | No questions. The agent shows one short assumptions block (each slot it had to assume), then builds. All slots count as assumed. The Studio is the correction path |

If unsure, the agent asks once with control question CT3 (section 6.5). The user's wording can be in any language ("no questions", "just build it", "sawal mat pocho", "khud decide karo"). The agent judges meaning. There is no keyword list.

### 3.2 Sizing

| Size | Rule of thumb |
|------|---------------|
| small | One screen or one component, one kind of user |
| medium | 2 to 5 screens, or one clear user journey |
| large | 6 or more screens, or several user roles, or several journeys |

The agent chooses and passes `taskSize`. If the user says "ask me more" or "fewer questions", the agent changes `taskSize` in the next call. A change is allowed at any time (trd 10.2).

### 3.3 Prompt harvesting

Before the first question the agent extracts slots the **user's message already states**. It passes them in `start.harvested` with the user's own words as `quote` (at most 120 characters each). Rules:

- Harvest only what is explicitly stated. Never infer from tone or from "obvious" things. If it is only implied, ask.
- Harvested slots count as stated, appear in the summary as `[you said]` with the quote, and can be corrected there.
- Harvest at most 20 slots. A quote must be a substring of the message (the agent's responsibility. The summary shows it so the user can catch a false quote).

### 3.4 Carry-over (Refine mode)

When `.intent/brief.json` has a current approval and a scene exists, `start` returns `carryOver` with the approved summary. The agent:
1. Decides which topics the new request touches.
2. Marks the rest as `kept` (they stay stated at their approved values).
3. Interviews only the touched topics, with a target of at most half the normal target.
4. Shows a summary that lists only changed lines and says "everything else stays as approved".

## 4. Interview Protocol

### 4.1 States

```
(request) --R-R01 says interview--> start --> asking <--> asking ...
                                               |
                          stop condition (section 8) 
                                               v
                                           summary --1 Exactly right--> approved --> build
                                               |--2 Change something--> asking (focused) --> summary
                                               |--3 Ask more questions--> asking (weakest) --> summary
(request) --Quick--> assumptions block --> build
asking/summary --user leaves--> abandoned (state kept for resume)
```

### 4.2 Turn procedure (agent)

1. `ask_user {kind:"start"}` once per interview. If the result says `resumed: true`, tell the user in two lines where the interview stands and continue from there. Never restart from question 1 (replaces the manual recovery in context.md section 11, see I1).
2. Choose the question: adapt a seed from `next.seeds`, or write a custom question with a `slot`.
3. `ask_user {kind:"question"}`. Show `renderedText` exactly as returned. End the turn and wait.
4. The user's reply maps to one answer: option numbers or labels, free text, `0` or an equivalent in the user's language (delegate), `s` or an equivalent (skip). A `+` after the answer means "remember this" (section 11.4). For multi-select questions the reply is numbers separated by commas.
5. The next `ask_user` call carries that reply as `previousAnswer` and the next question. One answer per call (R-R04).
6. If a reply is ambiguous, the next question clarifies it. The agent does not chat freely about interview content (R-R02).
7. When a stop condition holds, call `ask_user {kind:"summary"}` and follow section 9.

### 4.3 Server duties in each `ask_user` call (summary)

Record the previous answer, update slot statuses, compute the meter (section 7), enforce the caps and the repeat guard (section 8), append the fixed option lines, render the card, return `next` seeds for the weakest topic, and mirror the card to the Studio Interview tab if the Studio is open.

## 5. Question Design Rules

| ID | Rule |
|----|------|
| QR-01 | One question asks about one slot |
| QR-02 | Plain words, in the language the user writes in. No design jargon without a visible example ("Sharp / Slightly rounded", not "border radius") |
| QR-03 | 2 to 5 options, mutually exclusive unless the question is multi-select. Together they cover the likely space. Free text is always allowed |
| QR-04 | Neutral wording. No "recommended" tag during the interview. Do not always put the agent's own guess first. A user who wants a recommendation uses "Don't know, you choose" |
| QR-05 | No double-barreled questions ("Should it be fast and secure?") |
| QR-06 | Never ask what is already known: prompt, scene, brief, Design Profile, confirmed remembered values, earlier answers |
| QR-07 | Never ask about a capability the current milestone cannot deliver (seed `since`). If the user raises it, say it is not supported yet and record it in `other` |
| QR-08 | `whyAsked` states the effect on the result ("This sets the first frame size"), at most 200 characters. It never justifies the agent |
| QR-09 | Options describe visible outcomes ("Roomy with lots of space"), not bare adjectives |
| QR-10 | Never ask for secrets, credentials, real personal data or real people's names (R-R11, R-R25) |
| QR-11 | Never ask the same slot twice unless it was reopened (the server enforces this, section 8) |
| QR-12 | The language of the **question** follows the chat. The language of the **prototype text** is its own slot (`content.lang`). Never mix them up |

Example. Good: "Which look fits best? Minimal and calm / Bold and colorful / Corporate and clean / Playful and friendly / Dark and modern". Anti-example: "Do you want a modern, clean, professional and fast UI?" (four topics, no options, leading.)

## 6. Question Bank (resolves context.md XQ5)

### 6.1 Placement decision

| Option | Result |
|--------|--------|
| In the `always` rule files | Rejected. The 200-line budget (R-C01) is full |
| A new `on-request` canonical file (`interview-bank.md`, at most 120 lines) | Rejected. Needs trd 14.1 and R-C02 changes, 120 lines cannot hold 35 seeds with options and defaults, and agents may not load it |
| **Typed data in `core`, served by `ask_user`** | **Chosen.** `packages/core/src/interview/bank.ts`, validated by Zod at build time. `start` returns the first seeds, and every `ask_user` result returns the next 2 to 3 for the weakest topic. Zero cost in L0, deterministic, testable, versioned with the code |

`intent-core.md` carries only the instructions on how to use seeds (Appendix A). The bank text in 6.3 to 6.5 is normative: the code must match it, and a test compares them (section 17).

### 6.2 Seed schema

```ts
Seed = strict {
  id: string,                       // "G1", "ST4", "D2", "CT1"
  kind: "interview" | "deepdive" | "control",
  tier: "P1" | "P2" | "P3" | "D" | "C",
  since: "M1" | "M2" | "M3",        // milestone from which the product can act on the answer
  slot: Slot | null,                // null only for control seeds
  topic: Topic,
  text: Text(max 300),
  options: { id: string(1..20), label: Text(max 80) }[] (2..5),   // option id is also the profile value
  multi?: boolean,
  whyAsked: Text(max 200),
  default: { value: string | string[], rule: string } | "not-delegable",
  profileKey?: ProfileKey,          // key in the closed list of section 11.2
  dynamicOptions?: "screens"        // options built from the user's screen list (max 5)
}
```

Rules:
- The server **does not** put "Don't know, you choose", "Skip" or the remember hint into `options`. It appends them when rendering (trd 10.2 rule 1).
- The agent MAY rewrite the wording, translate it, or tune the options to the project. If it keeps the meaning, it passes `seedId` and keeps the option ids. If the meaning changes, it asks a custom question with an explicit `slot` and no `seedId`.
- `since` gating: seeds whose `since` is later than the running product's milestone are not returned in `next`.
- Deep-dive seeds never enter the meter. Control seeds never count toward `asked` or the soft cap.

### 6.3 Interview seeds (35)

Defaults are used when the user delegates. The agent may override a default when the project strongly implies another value, and must then say so in the summary line.

**Goal**

| ID Tier Since | Slot | Question and options | Default if delegated | Why |
|---|---|---|---|---|
| G1 P1 M1 | goal.purpose | What is the main thing this should help someone do? Buy or order something / Book or schedule / Learn or read / Track or manage things / Share or connect | not-delegable. Infer from the prompt, else ask once in free text | The main action decides which screen comes first |
| G2 P1 M1 | goal.platform | Where will people mostly use it? Phone / Computer / Both equally / Tablet or counter screen | Phone | This sets the first frame size and the layout |
| G3 P2 M1 | goal.success | What would make this a success for you? The main action is quick / It looks trustworthy / It is clear at first glance / It impresses in a demo | It is clear at first glance | Success decides what gets the most attention on screen |
| G4 P2 M1 | goal.protoUse | What is this prototype for? Showing an idea / Testing with users / Handing to developers / Pitching to others | Showing an idea | This sets how detailed and polished it must be |

**Users**

| ID Tier Since | Slot | Question and options | Default | Why |
|---|---|---|---|---|
| U1 P1 M1 | users.primary | Who will use it most? General public / Customers of a business / Staff or a team / Professionals or experts / Students | General public | Their needs decide wording, layout and complexity |
| U2 P2 M1 | users.skill | How comfortable are they with apps? Beginners / Average / Very comfortable / Mixed | Mixed | This decides how simple the screens must be |
| U3 P2 M1 | users.a11y | Any extra accessibility needs? (select all) None known / Large text / Screen reader / Big touch targets / Strong contrast | None known | Basic accessibility is always on. This adds extras |
| U4 P3 M1 | users.context | Where will they use it? At a desk or home / On the move / Outdoors in bright light / Mostly at night / On a shared counter screen | At a desk or home | Place of use affects size, contrast and theme |

**Screens**

| ID Tier Since | Slot | Question and options | Default | Why |
|---|---|---|---|---|
| S1 P1 M1 | screens.list | Which screens do you need first? Home and one detail screen / Home, list and detail / Sign in, home, settings / Onboarding, then home | Home, list and detail | The screen list is the base of the whole prototype |
| S2 P1 M1 | screens.nav | How should people move between screens? Bottom tabs / Top menu / Side menu / Links and back button only / One long page | Bottom tabs if platform is phone, else top menu | Navigation shapes the layout of every screen |
| S3 P2 M1 | screens.auth | Is sign-in needed? No / Yes, simple email / Yes, with social sign-in / Show signed-in and signed-out versions | No | Sign-in adds screens and states |
| S4 P3 M1 | screens.start | Which screen should open first? (options from the user's screen list, at most 5) | The first screen listed | The first screen is what people see first |

**Flow**

| ID Tier Since | Slot | Question and options | Default | Why |
|---|---|---|---|---|
| F1 P1 M1 | flow.main | Which path matters most? Browse, choose, confirm / Search, compare, decide / Fill a form, then success / Open, read, act | Browse, choose, confirm | The main path decides which buttons must work |
| F2 P2 M1 | flow.after | What happens after the main action is done? A success message / Go to another screen / Update in place / Show a summary or receipt | A success message | This decides the last step of the path |
| F3 P2 M1 | flow.links | Which buttons should lead somewhere? Only the main path / All main buttons / Everything that looks tappable | All main buttons | This sets how many interactions the prototype needs |
| F4 P3 M1 | flow.back | How should going back work? Back button / Close icon / Swipe or gesture hint / Not needed | Back button | Going back must work the same on every screen |

**Style**

| ID Tier Since | Slot | Question and options | Default | Why |
|---|---|---|---|---|
| ST1 P1 M1 | style.mood | Which look fits best? Minimal and calm / Bold and colorful / Corporate and clean / Playful and friendly / Dark and modern | Corporate and clean. Playful if users.primary is students | The look sets color, spacing and shape defaults |
| ST2 P1 M1 | style.palette | Which color direction? Blue / Green / Warm (red or orange) / Purple / Neutral (grey, black, white) | Blue | The main color is used for key buttons and links. Contrast is checked automatically |
| ST3 P1 M1 | style.theme | Light, dark or both? Light / Dark / Both with a switch / Follow the device | Light | This decides which color sets are built and checked |
| ST4 P2 M1 | style.density | How dense should screens feel? Roomy with lots of space / Balanced / Compact with more on screen | Balanced | This sets spacing between items |
| ST5 P2 M1 | style.corner | Which corner shape? Sharp / Slightly rounded / Very rounded / Pill shaped | Slightly rounded | Corner shape changes the feel of every button and card |
| ST6 P2 M1 | style.brand | Is there a brand or reference to follow? None / I have brand colors (type them) / Like an app I will name / Use my project's design system (only when a Design Profile exists) | None | Brand rules override the default look |
| ST7 P3 M1 | style.heading | How strong should headings feel? Light and quiet / Medium / Strong and heavy | Medium | This sets the weight and size contrast of headings |

**Content**

| ID Tier Since | Slot | Question and options | Default | Why |
|---|---|---|---|---|
| C1 P1 M1 | content.tone | What tone should the text have? Friendly and casual / Professional / Short and direct / Warm and encouraging | Professional | Tone decides every label and message |
| C2 P1 M1 | content.data | What sample data should it show? Products and prices / People and messages / Dates and appointments / Numbers and statistics / Articles or posts | By goal.purpose: Buy gives products, Book gives dates, Learn gives articles, Track gives numbers, Share gives people | Realistic sample data makes the prototype feel real. No real personal data is used |
| C3 P2 M1 | content.lang | Which language should the prototype text use? English / Another language written left to right, such as Roman Urdu (type it) | English | This sets all visible text. Right-to-left scripts are not supported yet |
| C4 P3 M1 | content.images | What should picture areas show? Neutral placeholders / I will add images later / No images | Neutral placeholders | This decides how image areas are built |
| C5 P3 M1 | content.name | Do you have a name or tagline to use? I have one (type it) / Make one up for me / No name needed | Make one up for me | A name appears in headers and titles |

**Behavior** (medium and large tasks)

| ID Tier Since | Slot | Question and options | Default | Why |
|---|---|---|---|---|
| B1 P2 M1 | behavior.states | Which states should be shown? (select all) Loading / Empty / Error / Success / Disabled | Loading, Empty, Error | States make the prototype feel real and are checked by design rules |
| B2 P2 M1 | behavior.forms | How should forms check input? Required fields only / Errors under each field / No forms | Required fields only | This decides what a form shows when something is wrong |
| B3 P2 M2 | behavior.responsive | How should it adapt to screen size? Phone first, stack on small screens / Same layout scaled everywhere / Different layout on computer / Phone only | Phone first, stack on small screens | This decides how layouts change between phone and computer |
| B4 P3 M3 | behavior.motion | Should there be motion? None / Subtle transitions / Playful motion | None | Motion changes how screens enter and leave |

**Edge cases** (large tasks)

| ID Tier Since | Slot | Question and options | Default | Why |
|---|---|---|---|---|
| E1 P3 M1 | edge.empty | What should an empty list or page show? A friendly message and a button / Nothing, just blank / Sample suggestions | A friendly message and a button | Empty screens are the first thing a new user sees |
| E2 P3 M1 | edge.long | What if a title or name is very long? Cut it with ... / Wrap to more lines / Shrink the text | Wrap to more lines | Long text can break layouts |
| E3 P3 M1 | edge.fail | What if something fails? A message with a retry button / Go back / Retry quietly | A message with a retry button | Failure screens need a clear way out |

### 6.4 Deep-dive seeds (6)

Used only on request: when the user picks "Change something" on a style line, or says a part matters a lot. They are micro-level questions. They do not enter the meter, the target or the soft cap. Slots are `deep.<name>`, topic style, tier D.

| ID Since | Slot | Question and options | Default |
|---|---|---|---|
| D1 M1 | deep.sectionSpacing | How much space between sections? Tight / Normal / Airy | Normal |
| D2 M1 | deep.shadow | How strong should shadows be? None / Subtle / Strong | Subtle |
| D3 M1 | deep.border | How visible should borders be? None / Thin / Bold | Thin |
| D4 M2 | deep.icons | Which icon style? Outline / Filled / Text only / No icons | Outline |
| D5 M1 | deep.buttonStyle | How should main buttons look? Solid color / Outlined / Text only | Solid color |
| D6 M1 | deep.imageShape | How should image corners look? Square / Rounded / Circle | Rounded |

All six use the same `whyAsked` pattern: "This fine-tunes one visual detail."

### 6.5 Control seeds (5)

Control questions manage the interview itself. They carry `slot: null`, do not count toward `asked` or the soft cap, and are never saved into the profile.

| ID | When | Question and options |
|----|------|----------------------|
| CT1 | After 3 delegate or skip answers in a row (SC-4) | Should I choose the rest for you and show the summary? Yes, choose the rest / No, keep asking |
| CT2 | When `over: true` (SC-2) | We have asked a lot already. What next? Show the summary now / A few more questions |
| CT3 | When R-R01 is unclear | Interview first, or build with my assumptions? Interview first / Build with assumptions |
| CT4 | When `start.preFilled` is not empty (M3) | I remember some of your earlier choices. Use them? Yes, use them all / Let me change some / Start fresh |
| CT5 | After "Change something" on the summary | How do you want to change it? I will type what to change / Ask me again about those lines |

### 6.6 Bank rules

- Wording is neutral (QR-04). Options never carry "recommended".
- The bank is English source text. Localization is an open question (IQ1).
- Adding a seed needs: a tier, a `since`, a slot, a default with a rule, a `whyAsked`, and (if it feeds the profile) a `profileKey`. The bank test enforces this (section 17).
- Seeds never contain scene data, secrets or URLs.

## 7. Understanding Meter

### 7.1 Principle

The meter shown to the user is labeled "Estimated understanding" (design 2.2). It is computed by the server from **slot evidence**, so it cannot be inflated by the agent. The agent may lower it, never raise it above the evidence. This extends trd 10.2 rule 2 (the T5 cap), see I2.

### 7.2 Calculation

1. **Slots in scope** for the task size: tier at or below the size, `since` reached, not `na`, not deep-dive.
2. **Slot value** from section 2.1 (stated 1.0, assumed 0.5, unknown 0). A later answer to the same slot replaces the earlier value. `reopen` sets a slot back to unknown.
3. **Topic score** = mean of its slot values.
4. **Topic status**: `none` below 0.25, `partial` from 0.25 up to 0.74, `covered` from 0.75.
5. **serverPercent** = floor of 100 times the sum over active topics of (weight times topic score), divided by the sum of the active weights.
6. **applied percent** = the smaller of the agent's `percent` and `serverPercent`. Then the existing cap applies: at most 89 while any required topic is `none`.
7. `meterApplied` returns `{ percent, serverPercent, capped, reason }`. The Studio and the plain-text card show `percent`.

Topic chips in the UI show the server's topic status (icon and text, design 2.2).

### 7.3 Evidence rules

- A slot becomes **stated** only through: a real answer (options or text), a harvested slot with a quote, or a confirmed remembered value.
- Delegate, skip, a default taken from the bank, and an unconfirmed remembered value give **assumed** (0.5).
- A custom question must set a real `slot` from section 2.2. `<topic>.other` records evidence but gives no meter credit.
- The agent must not report a topic as covered without matching slots. The server ignores the agent's topic claims and uses its own.

### 7.4 Worked example (small task, six active topics, total weight 90)

| Step | State | Sum of weight times score | Percent |
|------|-------|---------------------------|---------|
| Start | prompt states goal.purpose, goal.platform, users.primary, screens.list, style.mood, style.palette, content.tone. screens.nav and style.theme delegated. flow.main and content.data unknown | goal 20 x 1.0 = 20. users 10 x 1.0 = 10. screens 20 x 0.75 = 15. flow 15 x 0 = 0. style 15 x ((1 + 1 + 0.5) / 3) = 12.5. content 10 x 0.5 = 5. Total 62.5 | 62.5 / 90 = **69%** (flow is `none`, so the cap is also 89) |
| User answers F1 (flow.main) | flow becomes 1.0 | 62.5 + 15 = 77.5 | 77.5 / 90 = **86%** |
| User answers C2 (content.data) | content becomes 1.0 | 77.5 + 5 = 82.5 | 82.5 / 90 = **91%**. All required topics are at least partial, so SC-1 allows the summary |

**Note:** Slot counts per milestone differ (at M1: 11 / 24 / 33 for small / medium / large; at M2: 11 / 25 / 34; at M3: 11 / 25 / 35). The meter denominator changes by milestone, so the worked example holds only for small tasks at any milestone.

A user who delegates everything stays near 50% and reaches the summary through SC-3 or SC-4, with an honest label.

## 8. Stop Conditions and Fatigue

| ID | Condition | Behavior | Enforced by |
|----|-----------|----------|-------------|
| SC-1 | `percent` at least 90 and no required topic `none` | The agent MAY stop asking. It MUST show the summary | S (cap) / C |
| SC-2 | `over: true` (soft cap passed) | Offer CT2. Never exceed the cap by more than 5 questions without the user's consent | C. Server returns a hint |
| SC-3 | The user asks to stop or skip at any time | Show the summary if at least one answer exists. Otherwise use Quick mode | C |
| SC-4 | 3 consecutive delegate or skip answers | Offer CT1. If yes, choose the rest, fill defaults and show the summary | C. Server returns `hint: "fatigue"` |
| SC-5 | `ask_user` for a slot that is already stated and was not reopened | Rejected with `E_BAD_REQUEST` ("slot already answered, pass reopen if you misunderstood") | S |
| SC-6 | The user returns from the summary with "Ask more" 3 times | List the remaining unknown and assumed slots in the next summary and ask the user: stop and build, or continue | C |
| SC-7 | Misunderstanding detected (answer contradicts an earlier slot) | Pass `reopen` for the affected slots. The meter falls honestly | S |

Never stop because of cost, time or the agent's own tiredness. A low final percent is valid and is shown to the user.

## 9. Summary and Approval

### 9.1 Content

Built from `ask_user {kind:"summary"}` (trd 10.2). It has: one paragraph, one line per active topic, the list of delegated choices, and the estimated understanding. Each line carries a source tag.

| Tag | Source | Shown as |
|-----|--------|----------|
| `prompt` | The user's message (harvested) | `[you said]` plus the quote |
| `answer` | An answer in the interview | `[your answer]` |
| `remembered` | Confirmed remembered value | `[remembered]` |
| `delegated` | Chosen by the agent | `[chosen by me]` |

Example (plain-text card):

```
Here is what I understood (estimated understanding ~86%)
[you said]     Goal: phone app to book salon appointments ("book salon appointments")
[your answer]  Screens: Home, Services, Booking, Confirmation
[remembered]   Look: minimal and calm, slightly rounded corners
[chosen by me] Theme: light
[chosen by me] Sign-in: none
Decided by me: Theme (light), Sign-in (none)
  1) Exactly right
  2) Change something
  3) Ask more questions
```

### 9.2 Options

Always in this order: **Exactly right**, **Change something**, **Ask more questions** (design 2.3). `[chosen by me]` lines must match `delegated[]` exactly, or the server returns `E_BAD_REQUEST` (trd 10.2 rule 3).

### 9.3 Change something

The agent asks control question CT5. If the user types the change, it arrives as `summaryChoice.changes[]`. If the user wants questions, the agent asks the relevant seeds (deep-dive seeds are allowed here). Changed slots become stated. Then the agent shows a short summary of the changed lines only.

### 9.4 Ask more

The agent asks about the weakest topics (lowest topic score first, then highest weight). SC-6 limits loops.

### 9.5 Approval record (`.intent/brief.json`, committed, see I7)

```ts
Brief = strict { schemaVersion: 1, current: Approval | null, history: Approval[] (max 5, newest first) }
Approval = strict {
  sessionKey: ISO, approvedAt: ISO, mode: "full" | "refine",
  sceneRevisionAtApproval: int >= 0,          // 0 when no scene exists yet
  percent: int, 
  summary: { paragraph: Text(max 800), items: { topic, text: Text(max 300), source }[], delegated: { topic, text: Text(max 200) }[] }
}
```

- Written by `core` on `exactly-right`. The agent has no write path.
- It contains the user's words. The README warns the user to review it before committing. R-R11 forbids secrets in it.
- If a scene exists at approval, `core` also saves an `interview-approved` version (trd 10.2 rule 5). If none exists (the common first run), the **baseline for the acceptance-rate metric is the `first-render` version** created at the first `apply_patch` to `"scene"` after approval (trd 17.2). This clarifies, and does not change, trd 17.2.

## 10. Delegation Policy

| ID | Rule |
|----|------|
| DP-1 | The default is chosen in this order: (1) the project (Design Profile, existing scene), (2) a remembered profile entry, (3) the bank default and its rule in 6.3, (4) the most conservative neutral value |
| DP-2 | The agent says its choice in one line at once ("I will use a light theme.") and names the reason if it overrode the bank default |
| DP-3 | `goal.purpose` is not delegable. The agent infers it from the prompt or asks once in free text. A user who still says "you choose" gets the best inference marked `[chosen by me]`, with the purpose line placed first in the summary |
| DP-4 | Never delegate anything involving real data, credentials, legal wording or real people's names |
| DP-5 | Every delegated choice appears in the summary and can be changed there or later in the Studio |
| DP-6 | A delegated default never lowers accessibility. Accessibility floors are fixed (R-R33) |

## 11. Intent Profile: Derivation (resolves rules.md C-R2)

### 11.1 Decision

`core` derives the profile. It is deterministic and uses no AI. The agent never writes it (R-R36 stands). The user can edit and delete it in the Studio. Two stores:

| File | Content | Git |
|------|---------|-----|
| `.intent/signals.json` | Raw normalized signals (at most 500, oldest dropped) | gitignored, local only |
| `.intent/profile.json` | Derived entries (trd 17.1, extended in 11.7) | committed |

Active from **M3** (PRD FR-A8). In M1 and M2 the seeds already carry `profileKey`, but no signals are recorded (never half-build).

Neither file holds free text. Values come from closed lists. Entry text is generated from fixed templates in the bank.

### 11.2 Closed key list

| Key | Allowed values | Fed by |
|-----|----------------|--------|
| `style.mood` | minimal, bold, corporate, playful, dark | ST1, chip `simpler` |
| `style.palette` | blue, green, warm, purple, neutral | ST2 |
| `style.theme` | light, dark, both, device | ST3 |
| `style.density` | roomy, balanced, compact | ST4, edits, chips |
| `style.corner` | sharp, slight, round, pill | ST5, edits |
| `style.heading` | light, medium, strong | ST7, edits |
| `content.tone` | friendly, professional, direct, warm | C1 |
| `layout.navigation` | tabs, top, side, links, single | S2 |
| `layout.responsive` | phone-first, scale, adaptive, phone-only | B3 |
| `product.platform` | phone, computer, both, tablet | G2 |
| `a11y.extras` | large-text, screen-reader, big-targets, contrast (a list) | U3 |
| `behavior.states` | loading, empty, error, success, disabled (a list) | B1 |
| `behavior.forms` | required-only, field-errors, none | B2 |
| `interview.depth` | short, normal | derived (11.5) |
| `avoid.<key>` | one value of that key the user rejected | reject signals |

Slots about the project (screens, flow, content data, names, brand) never enter the profile. They describe one project, not the person.

### 11.3 Signal kinds

| Kind | Created when |
|------|--------------|
| `answer` | The user answers a seed that has a `profileKey` (needs `seedId`) |
| `explicit` | The user adds `+` to the answer in chat, or ticks "Remember this choice" in the Studio card |
| `confirm` | The user accepts a remembered value (CT4 "use them all") |
| `reject` | The user changes a remembered value, or changes a `[chosen by me]` line at the summary |
| `edit` | A Studio edit matches a row in 11.4 |

Signal record: `{ key, value, kind, session: <sessionKey ISO>, at: ISO }`. At most one signal per (key, value, kind, session). Signals are appended **after** the main write, under a separate lock (`signals`). A failure is logged and never fails the main write.

### 11.4 Edit and chip mapping (deterministic)

Only `kind: "direct"` patches with status `applied` count. An edit undone within the session counts for nothing.

| Studio action | Condition | Signal |
|---------------|-----------|--------|
| `set /style/radius` on button, input or container (resolved px) | 2 or more distinct objects end in the same bucket in one session | `style.corner`: 0 to 2 sharp, 3 to 8 slight, 9 to 20 round, 21 or more pill |
| `set /layout/gap` or `/layout/padding` on containers | 2 or more containers move the same direction, each by at least 8 px | `style.density`: roomy if larger, compact if smaller |
| `set /style/fontWeight` on `text` objects with `as` h1 to h3 | 2 or more objects, same direction | `style.heading`: 400 light, 500 medium, 600 or 700 strong |
| Chip `more-space` or `less-clutter` applied | once per session | `style.density` = roomy |
| Chip `simpler` applied | once per session | `style.mood` = minimal |
| Everything else (bigger, smaller, different-color, more-premium, position, size) | none | **no signal** (ambiguous). The product does not guess |

### 11.5 Promotion, confidence, decay

| ID | Rule |
|----|------|
| PR-1 | An `explicit` signal creates an entry at once with count 2 |
| PR-2 | Without `explicit`, an entry is created when the same (key, value) appears in **2 different sessions** (kinds `answer`, `confirm`, `edit`). Two signals in one session count once |
| PR-3 | `reject` of a remembered value adds 1 to that entry's `contra`. A new value needs 2 sessions to replace it (PR-2). A `reject` also records `avoid.<key>` for the rejected value after 2 sessions |
| PR-4 | `confidence = count / (count + contra + 1)`. One explicit entry starts at 2 / 3 = 0.67 |
| PR-5 | An entry is used for prefill only if `confidence` is at least 0.6 and `lastSeenAt` is within 180 days. Older entries stay visible in settings |
| PR-6 | A deleted entry creates a block `{key, value}`. It is not derived again, except by a new `explicit` signal |
| PR-7 | `interview.depth = short` when delegate plus skip answers are at least 50% of answered questions in 2 consecutive sessions. Effect: P2 slots without a stated value are shown as chosen defaults in the summary rather than asked, and the agent says so. Cleared after 1 session with fewer than 25% |
| PR-8 | Deriving never reads scene text, feedback text or answers' free text. Only normalized values |

### 11.6 Using the profile

- `start` returns `preFilled`: entries for slots in scope that pass PR-5, each with `slot`, `value`, `text` (generated), `confidence`.
- The agent asks CT4 once. "Use them all" gives each slot status `stated` (a `confirm` signal). "Let me change some": each is asked as a normal seed, and a changed value is a `reject`. "Start fresh": nothing is prefilled this session and no `reject` is recorded.
- Until confirmed, a remembered value counts as assumed (0.5).
- The prompt always beats the profile. A harvested slot overrides a remembered one.
- Prefilled lines appear in the summary as `[remembered]`.

### 11.7 User control and schema changes

- Studio settings page "Remembered preferences": list, edit value, delete entry, "Forget everything", and a switch "Learning on or off". Config key `profile.learning` (default `true`, local only). `init` prints one line saying that learning is local and how to turn it off.
- Routes (additions to trd 11.3): `GET /api/profile`, `PUT /api/profile/:id`, `DELETE /api/profile/:id`, `POST /api/profile/clear`.
- Amended profile entry (trd 17.1):

```ts
ProfileEntry = strict { id: string, key: ProfileKey, value: string | string[], text: Text(max 200),
  explicit: boolean, count: int, contra: int, confidence: number 0..1,
  sources: { kind: "answer"|"explicit"|"confirm"|"reject"|"edit", sessions: ISO[] (max 10) }[],
  createdAt: ISO, lastSeenAt: ISO }
IntentProfile = strict { schemaVersion: 1, entries: ProfileEntry[], blocked: { key, value }[] }
SignalsFile = strict { schemaVersion: 1, signals: Signal[] (max 500) }
```

## 12. Interview Metrics (`.intent/metrics.json`, gitignored)

Defines the file that trd 14.3 lists in the gitignore but never specifies (see I8).

```ts
InterviewMetrics = strict { schemaVersion: 1, sessions: {
  sessionKey: ISO, mode: "full"|"refine"|"quick", taskSize,
  asked: int, answered: int, delegated: int, skipped: int, harvested: int,
  prefilledShown: int, prefilledConfirmed: int, prefilledChanged: int,
  summaryChoices: ("exactly-right"|"change"|"ask-more")[], finalPercent: int, serverCaps: int, abandoned: boolean
}[] (last 50) }
```

Reports (computed on demand, shown in the Studio, never sent anywhere): asked per session over time, delegate rate, prefill acceptance rate, share of sessions approved at the first summary. This serves PRD section 9 "interview efficiency". The acceptance-rate metric stays as defined in trd 17.2.

## 13. Canonical File Mapping

`intent-core.md` stays within 90 lines (context.md 8.1). It covers R-R01 to R-R11, R-R29, R-R31 and R-R35, and repeats the five top rules (R-C07). The draft is in Appendix A. `tool-usage.md` (110 lines) covers R-R12 to R-R23, R-R26 to R-R28 and the error table. `studio.md` covers R-R28 to R-R31. This document specifies behavior. The canonical files only tell the agent WHEN to act and WHICH tool to call (R-C01).

## 14. Consolidated Tool Contract Changes (all proposed, none applied)

| Tool | Change | Amendment |
|------|--------|-----------|
| `ask_user` | New `kind: "start"` with `taskSummary`, `taskSize?`, `harvested?` ({slot, quote}). Output: `sessionKey`, `plan`, `seeds`, `preFilled?`, `carryOver?`, `resumed?` | I1, I7 |
| `ask_user` question | `slot` required (or `seedId`, which implies it). `control?: "CT1".."CT5"` (not counted) | I1, I9 |
| `ask_user` input | `reopen?: Slot[]`. `previousAnswer.remember?: boolean` | I2, I5 |
| `ask_user` summary | Items get `source` and optional `quote` | I6 |
| `ask_user` output | `next: { topic, seeds[] }`, `meterApplied.serverPercent`, topic statuses computed by the server | I1, I2 |
| Server | Repeat guard (SC-5), brief and metrics writes, profile signals (M3) | I2, I3, I7, I8 |

`ask_user` stays one tool and the six tools stay six (PRD FR-S1).

## 15. Traceability

| Requirement | Sections |
|-------------|----------|
| FR-A1 | 3.1, rules R-R01, Appendix A |
| FR-A2 | 4, 5, 6 |
| FR-A3 | 4.3, 6.2 (server appends the lines) |
| FR-A4 | 7, 8 |
| FR-A5 | 9 |
| FR-A6 | 2.2, 3.2, 6.3, 6.4 |
| FR-A7 | 4.2 step 4, design 2.4 (plain-text card) |
| FR-A8 | 11, 12 |

## 16. Conflicts, Amendments and Flags

Nothing in earlier documents has been changed silently. Each item needs the user's ruling, then a dated change-log entry in the affected document.

| ID | Conflict or amendment | Affects | Rec |
|----|----------------------|---------|-----|
| I1 | Add `kind: "start"`. The bank lives in `core` and is served as `next` seeds. A second `start` on an active interview returns `resumed: true`. **Resolves context.md XQ5. Supersedes the manual-recovery fallback in context.md C-X2 and section 11 step 3** | trd 10.2, context 8.1 and 11 | **decide** |
| I2 | Meter is computed from slot evidence. Questions carry `slot`. Applied percent is the smaller of the agent's and the server's. `reopen` added. Extends T5 | PRD FR-A4, trd 10.2 | **decide** |
| I3 | Profile is derived by `core` from `signals.json` with the promotion rules of 11.5. **Resolves rules.md C-R2.** R-R36 stays as written | architecture 6 and 17, trd 17.1, 11.3, 14.3 | **decide** |
| I4 | Closed profile key list, extended entry schema, `profile.learning` config key | trd 15, 17.1 | accept |
| I5 | "Remember this" affordance: `+` suffix in chat, checkbox in the Studio card. Card gains a hint line from M3 | design 2.1 and 2.4, trd 10.2 | accept |
| I6 | Summary items carry `source` (and `quote` for harvested lines) | design 2.3, trd 10.2 | accept |
| I7 | Add committed `.intent/brief.json`. Clarifies that `interview-approved` exists only when a scene exists and that the first-run metric baseline is `first-render` | architecture 6, trd 10.2 rule 5, 14.3, 17.2 | **decide** |
| I8 | Define `.intent/metrics.json` (gitignored). It is listed in trd 14.3 but never specified | architecture 6, trd 14.3 | accept |
| I9 | Interview modes (Full, Refine, Quick, None), control questions CT1 to CT5, and the skip behavior. Refines R-R01. **Depends on the ruling on C-R1** | rules R-R01, PRD FR-A1 | accept |
| I10 | design 2.2 lists 7 topic chips and omits edge cases, while trd has 8 topics and design 2.1 names an "Edge cases" round. Add an "Edge cases" chip, shown only for large tasks | design 2.2 | accept |
| I11 | **Cross-reference errors in rules.md (found while writing this doc).** (a) R-R36 says "see section 10, item C-R2". The conflict table is section 20. Section 10 is "Asking the User". (b) rules section 2 item 1 cites "R-B27 to R-B30" as security rules. R-B27 is the golden-file rule. The security rules are R-B28 to R-B30. (c) My instruction to the build agent for rules.md also said "Section 10 lists the conflicts". It is section 20 | rules R-R36, section 2 | accept |

Ruling order that avoids rework: C-R1 first (then I9), then C-R2 with I3, then T5 with I2, then I1, then I7. The rest can go in one batch.

Note: memory.md section 6.5 counts 35 items from earlier docs plus 5 of its own. With I1 to I11 the Pending total becomes 51. The agent must recompute it from the register and never type it by hand (memory M5).

## 17. Testability and Acceptance

### 17.1 Tests this doc requires (for test.md)

| Test | Checks |
|------|--------|
| Bank validity | 35 interview, 6 deep-dive and 5 control seeds. 2 to 5 options each. All length limits from trd 10.2. Every non-control seed has a slot, a default with a rule, and a `since`. Every `profileKey` is in the closed list. Option ids are unique within a seed |
| Bank equals doc | The seed table in 6.3 and the bank data agree (ids, slots, tiers, option ids) |
| Slot map | Every slot in 2.2 has exactly one seed. Slot counts per size are 11, 25 and 35 (at M3) |
| Meter golden table | The worked example of 7.4 gives 69, 86 and 91. Edge cases: all delegated, all stated, reopen, na slots, normalization by size |
| Caps | A required topic `none` caps at 89. Agent percent above server percent is lowered. Agent percent below server percent is kept |
| Repeat guard | SC-5 returns `E_BAD_REQUEST`. `reopen` clears it |
| Fatigue | 3 delegate or skip answers return the fatigue hint. Control questions are not counted |
| Resume | Kill the agent session mid-interview. `start` returns `resumed: true` with the same state |
| Summary | Delegated list must match exactly. Source tags and quotes render. Plain-text card golden file |
| Profile derivation | Golden scenarios for PR-1 to PR-8, the edit mapping in 11.4, the confidence formula, decay, blocks, and one-signal-per-session |
| Privacy | Profile and signals contain no free text. Injection test: harvested quotes and answers containing instructions never alter tool behavior |
| Rule coverage | R-R01 to R-R11, R-R29, R-R31 and R-R35 appear in `intent-core.md` (rules R-C02) |
| Interview simulator | A scripted agent runs a full small, medium and large interview against the real server and checks question counts, meter path and the final summary |

### 17.2 Acceptance per milestone

| Milestone | Included |
|-----------|----------|
| M1 | `start`, `next` seeds, tiers P1 to P3 (with `since` M1), server meter and caps, repeat guard, fatigue, summary with source tags, delegation list, Quick mode, Refine mode with `brief.json`, plain-text card, Studio Interview tab (design 14), `metrics.json`, resume. No profile |
| M2 | Seeds gated at M2 (B3, D4) become active. Chips for edge cases. Interview polish from M1 findings |
| M3 | Signals, profile derivation, CT4 and prefill, `+` remember, Studio settings page for remembered preferences, `interview.depth`, B4 seed. Efficiency report |

## 18. Open Questions

- IQ1. The fixed lines ("Don't know, you choose", "Skip", the remember hint) are English in v1, but questions follow the user's chat language, so a card can mix languages. Options: a `lang` input with a message catalog (English shipping, others added later), or leave English. Decide with design DQ3 in plan.md.
- IQ2. Should each scene object remember which slots produced it (an "intent trace")? It would make edit signals more precise and allow per-topic acceptance rates. Parked for after M3.
- IQ3. How a Tier 1 agent shows multi-select replies ("1,3") and the `+` suffix naturally. Verify in M1 step 0 with real agents.
- IQ4. Should the Studio offer a "This part matters a lot" button that opens deep-dive seeds for the selected object? Decide in M2 planning.
- IQ5. Reference images (screenshots) as interview input are out of scope for v1. Revisit after v1.0.0.

## 19. Flags for Later Documents

- **plan.md:** M1 items: bank data and validity test, `start`, `next`, server meter and caps, repeat guard, summary with sources, `brief.json`, `metrics.json`, interview simulator, Quick and Refine modes. M3 items: signals, derivation, CT4, `+`, settings page, `interview.depth`. Add the Reconciliation Pass (memory M4) before M1. Resolve IQ1 with DQ3.
- **test.md:** everything in 17.1. Also tests that no seed asks about a capability beyond its `since`.
- **loop.md:** an interview loop with the same slot rejected three times or an agent that keeps re-asking stops and reports (R-B05, R-R22).
- **review.md:** check that no seed violates QR-01 to QR-12, and that no profile key can hold free text.
- **memory.md:** record I1 to I11 in the Amendment Register (all Pending), and the two resolutions of XQ5 and C-R2 after the user rules.
- **pr.md:** a PR that changes the bank must list changed seed ids and the matching doc section.

## 20. Change Log

- 2026-10-26: v0.1 created from prd.md, design.md, architecture.md, trd.md, rules.md, context.md and memory.md v0.1. Proposes I1 to I11. Resolves XQ5 and C-R2 as proposals only.
- 2026-11-02: v0.2 Reconciliation Pass applied. I1 (ask_user kind:start), I7 (brief.json), P1 (Refine mode + metrics to M2), P8 (human trial M3), TS9 (Tier 1 testing), V1 (independent review). C2 (design system), TS1 (initial/final match). All other items Accepted.

---

## Appendix A: Draft of canonical `intent-core.md`

Budget: at most 90 lines (context.md 8.1). The draft below is about 60 lines. The generator adds per-agent headers. Rule markers feed the coverage test (R-C02).

```
<!-- intent-core.md | appliesTo: always | max 90 lines -->
# Intent Core: understand before you build
Top rules: interview design and vague build requests first. Read before you write and use the latest baseRevision. Never modify a locked object. Open the Studio only when the user asks.
<!-- rules: R-R01, R-R12, R-R13, R-R23, R-R28 -->

## When to interview <!-- rules: R-R01 -->
- Interview when the user asks to create or substantially change a UI, prototype or product design, or the request is vague enough for several different results.
- Do not interview for typos, bug fixes, renames, questions or precise small edits.
- Unsure? Ask once: "Interview first, or build with my assumptions?"
- User says skip (any language): list your assumptions in one short block, then build.
- Example: "Design a booking app for my salon" means interview. Anti-example: "Make the Save button blue" means just do it.

## How to interview <!-- rules: R-R02, R-R03, R-R04 -->
1. Call ask_user with kind "start". If it says resumed, tell the user in two lines where you are and continue.
2. Ask one question per turn with ask_user kind "question". Start from the seeds in the result. Keep seedId and option ids if the meaning stays the same. Custom questions need a slot.
3. Show renderedText exactly as returned. Never edit or remove "Don't know" or "Skip".
4. Pass the user's reply as previousAnswer in the next ask_user call. One answer per call.
5. Ask in the user's language. The prototype's text language is a separate question.

## Good questions <!-- rules: R-R05 -->
- One topic, one slot, plain words, 2 to 5 distinct options, neutral wording, a short whyAsked.
- Never ask what the prompt, the scene, the remembered profile or an earlier answer already tells you.
- Put what the prompt clearly states into start.harvested with the user's own words as the quote.
- Never ask for secrets or real personal data. <!-- rules: R-R11 -->

## The meter <!-- rules: R-R06, R-R07 -->
- It is an estimate and it can go down. Never push it up to stop sooner. The server limits it using evidence.
- If an answer shows you misunderstood, pass the slot in reopen.
- When over is true, or after 3 delegate or skip answers in a row, offer to stop and show the summary.

## Delegation <!-- rules: R-R08 -->
- "Don't know, you choose": pick a sensible default, say it in one line, and list it under delegated in the summary.
- Never present a delegated default as the user's decision.

## Summary and approval <!-- rules: R-R09, R-R10 -->
- Before building, call ask_user with kind "summary". Build only after "Exactly right".
- "Change something": ask only about the lines they pick, then show the changed lines.
- "Ask more": ask about the weakest topics.
- Only exception: the user skipped the interview.

## After approval <!-- rules: R-R29, R-R31 -->
- Build the first scene with validate and apply_patch (see tool-usage).
- Offer the Studio once, in one sentence. Do not open it yourself.
- Never say the user approved something unless the tools or versions show it.

## Honest numbers <!-- rules: R-R35 -->
- Never claim a 97% or 99% match. Report only numbers the tools return, as local measures.
``` 
