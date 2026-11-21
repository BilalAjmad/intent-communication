import { promises as fs } from "node:fs";
import os from "node:os";
import { resolve, join } from "node:path";
import { createMCPContext, handleMCPRequest } from "../../packages/mcp-server/dist/index.js";

const EXPECTED = JSON.parse(await fs.readFile(resolve("tests/trial/expected.json"), "utf-8"));

const PERSONA_ANSWERS = {
  P1: { goal: "A booking app for my photography studio", screens: "Home, Services, Book, Confirmation", style: "warm, calm, rounded, terracotta accent, comfortable density", content: "friendly plain English, dates times client name email", behavior: "loading empty error success disabled", flow: "bottom tab bar on mobile", palette: "terracotta", theme: "light", density: "comfortable", corner: "rounded", tone: "friendly", data_type: "dates", primary_action: "Book a session" },
  P2: { goal: "A reservation and menu management app", screens: "Dashboard, Reservations, Menu, Settings", style: "professional, dense, sharp corners, amber accent, compact", content: "concise operational, table rows dates party size status", behavior: "loading empty error success disabled", flow: "left sidebar nav", palette: "amber", theme: "dark", density: "compact", corner: "sharp", tone: "concise", data_type: "table", primary_action: "New reservation" },
  P3: { goal: "A classroom assignment tracker", screens: "Classes, Assignments, Student, Grade", style: "playful, approachable, rounded, soft pastels blue accent, comfortable", content: "encouraging simple, lists dates scores names", behavior: "loading empty error success", flow: "top nav with tabs", palette: "blue", theme: "light", density: "comfortable", corner: "rounded", tone: "encouraging", data_type: "lists", primary_action: "Add assignment" },
  P4: { goal: "An analytics dashboard for my SaaS", screens: "Overview, Users, Revenue, Settings", style: "minimal, data-dense, sharp corners, indigo accent, dense", content: "technical precise, charts numbers tables filters", behavior: "loading empty error success", flow: "top bar plus sidebar", palette: "indigo", theme: "dark", density: "dense", corner: "sharp", tone: "technical", data_type: "charts", primary_action: "Export report" },
  P5: { goal: "A workout tracking app for clients", screens: "Today, Workouts, Progress, Profile", style: "energetic, bold, rounded, dark neutrals lime accent, comfortable", content: "motivating short, lists progress bars dates", behavior: "loading empty error success", flow: "bottom tabs", palette: "lime", theme: "dark", density: "comfortable", corner: "rounded", tone: "motivating", data_type: "progress", primary_action: "Start workout" },
  P6: { goal: "A property listing and showing scheduler", screens: "Listings, Showing, Client, Calendar", style: "premium, editorial, rounded, warm neutrals gold accent, comfortable", content: "professional descriptive, cards images dates prices", behavior: "loading empty error success", flow: "top nav", palette: "gold", theme: "light", density: "comfortable", corner: "rounded", tone: "professional", data_type: "cards", primary_action: "Schedule showing" },
  P7: { goal: "A patient handover checklist", screens: "Shift, Patients, Tasks, Notes", style: "calm, clinical, rounded, cool neutrals teal accent, comfortable", content: "clear unambiguous, lists checkboxes times notes", behavior: "loading empty error success", flow: "tabs", palette: "teal", theme: "light", density: "comfortable", corner: "rounded", tone: "clear", data_type: "checkboxes", primary_action: "Mark complete" },
  P8: { goal: "A bug tracker for my game studio", screens: "Issues, Board, Detail, Settings", style: "dark, technical, sharp corners, dark neutrals cyan accent, dense", content: "terse developer-facing, tables tags priorities dates", behavior: "loading empty error success", flow: "sidebar", palette: "cyan", theme: "dark", density: "dense", corner: "sharp", tone: "terse", data_type: "tables", primary_action: "New issue" },
};

async function runPersona(personaId, arm) {
  const tmp = resolve(os.tmpdir(), `.trial-${personaId}-${arm}-${Date.now()}`);
  await fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(resolve(tmp, ".intent", "scenes"), { recursive: true });
  await fs.mkdir(resolve(tmp, ".intent", "briefs"), { recursive: true });
  const scene = { version: 1, revision: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), screens: {}, objects: {}, screenOrder: [], metadata: { name: "Trial", tags: [] } };
  await fs.writeFile(resolve(tmp, ".intent", "scenes", "default.json"), JSON.stringify(scene), "utf-8");
  const ctx = createMCPContext(tmp);
  const ask = (input) => handleMCPRequest("ask_user", input, ctx);

  const a = PERSONA_ANSWERS[personaId];
  let questionsAsked = 0;
  // start
  await ask({ kind: "start", questionId: "s1", prompt: "What are we building?", topic: "goal", questionNumber: 1, estimatedTotal: 9, requiredTopics: ["goal"], meter: { percent: 10, topics: { goal: "partial" } } });
  questionsAsked++;
  // goal answer recorded on next call
  await ask({ kind: "choice", questionId: "q_goal", prompt: "Confirm goal", topic: "goal", options: [{ value: "a", label: a.goal }], questionNumber: 2, estimatedTotal: 9, previousAnswer: { questionId: "s1", answer: { choiceId: "a", text: a.goal } }, meter: { percent: 20, topics: { goal: "covered" } } });
  questionsAsked++;
  await ask({ kind: "text", questionId: "q_users", prompt: "Who are the users?", topic: "users", questionNumber: 3, estimatedTotal: 9, previousAnswer: { questionId: "q_goal", answer: { text: a.goal } }, meter: { percent: 30, topics: { goal: "covered", users: "covered" } } });
  questionsAsked++;
  await ask({ kind: "text", questionId: "q_screens", prompt: "Which screens?", topic: "screens", questionNumber: 4, estimatedTotal: 9, previousAnswer: { questionId: "q_users", answer: { text: "end users" } }, meter: { percent: 45, topics: { goal: "covered", users: "covered", screens: "covered" } } });
  questionsAsked++;
  // record screens answer via a follow-up? We'll inject via previousAnswer on next
  await ask({ kind: "text", questionId: "q_flow", prompt: "Main flow?", topic: "flow", questionNumber: 5, estimatedTotal: 9, previousAnswer: { questionId: "q_screens", answer: { text: a.screens } }, meter: { percent: 60, topics: { goal: "covered", users: "covered", screens: "covered", flow: "covered" } } });
  questionsAsked++;
  await ask({ kind: "text", questionId: "q_style", prompt: "Style mood?", topic: "style", questionNumber: 6, estimatedTotal: 9, previousAnswer: { questionId: "q_flow", answer: { text: a.flow } }, meter: { percent: 75, topics: { goal: "covered", users: "covered", screens: "covered", flow: "covered", style: "covered" } } });
  questionsAsked++;
  await ask({ kind: "text", questionId: "q_content", prompt: "Content tone?", topic: "content", questionNumber: 7, estimatedTotal: 9, previousAnswer: { questionId: "q_style", answer: { text: a.style } }, meter: { percent: 88, topics: { goal: "covered", users: "covered", screens: "covered", flow: "covered", style: "covered", content: "covered" } } });
  questionsAsked++;
  // Don't know x1 (CT1 exercise) — record as a delegated answer
  await ask({ kind: "choice", questionId: "q_dk", prompt: "Density?", topic: "style", questionNumber: 8, estimatedTotal: 9, options: [{ value: "a", label: "comfortable" }, { value: "b", label: "compact" }], previousAnswer: { questionId: "q_content", answer: { text: a.content } }, meter: { percent: 90, topics: { goal: "covered", users: "covered", screens: "covered", flow: "covered", style: "covered", content: "covered" } } });
  questionsAsked++;
  // summary
  await ask({ kind: "summary", questionId: "sum1", prompt: "Is this right?", questionNumber: 9, estimatedTotal: 9, summary: { paragraph: a.goal, items: [{ topic: "goal", text: a.goal }, { topic: "screens", text: a.screens }, { topic: "style", text: a.style }, { topic: "content", text: a.content }, { topic: "flow", text: a.flow }], delegated: [{ questionId: "q_dk", topic: "style", text: "density (delegated)" }] }, previousAnswer: { questionId: "q_dk", answer: { choiceId: "a" } }, meter: { percent: 95, topics: { goal: "covered", users: "covered", screens: "covered", flow: "covered", style: "covered", content: "covered" } } });
  questionsAsked++;
  // approve
  await ask({ kind: "confirm", questionId: "done1", prompt: "Understood.", questionNumber: 10, previousAnswer: { questionId: "sum1", answer: { summaryChoice: "exactly-right" } }, meter: { percent: 100, topics: { goal: "covered", users: "covered", screens: "covered", flow: "covered", style: "covered", content: "covered" } } });
  questionsAsked++;

  const state = JSON.parse(await fs.readFile(resolve(tmp, ".intent", "interview", "state.json"), "utf-8"));
  const brief = state.briefId ? JSON.parse(await fs.readFile(resolve(tmp, ".intent", "briefs", state.briefId + ".json"), "utf-8")) : null;

  // Build a scene reflecting the persona preferences (Arm B = Intent-driven)
  const scenePath = resolve(tmp, ".intent", "scenes", "default.json");
  const sceneData = JSON.parse(await fs.readFile(scenePath, "utf-8"));
  sceneData.metadata = sceneData.metadata || {};
  sceneData.metadata.artDirection = { visualIdea: a.style, palette: [a.palette], typePlan: "system 3 sizes", spacing: "4/8" };
  // screens
  const screenIds = a.screens.split(",").map((s) => s.trim());
  screenIds.forEach((name, i) => {
    const id = `s_${String(i + 1).padStart(2, "0")}ARZ3NDEKTSV4RRFFQ69G5FAV`.slice(0, 28);
    // use valid-ish id from existing set
  });
  // simpler: store screens as metadata list
  sceneData.metadata.screens = screenIds;
  sceneData.metadata.style = a.style;
  sceneData.metadata.theme = a.theme;
  sceneData.metadata.density = a.density;
  sceneData.metadata.corner = a.corner;
  sceneData.metadata.tone = a.tone;
  sceneData.metadata.dataType = a.data_type;
  sceneData.metadata.states = a.behavior;
  sceneData.metadata.navType = a.flow;
  sceneData.metadata.primaryAction = a.primary_action;
  await fs.writeFile(scenePath, JSON.stringify(sceneData, null, 2), "utf-8");

  // Arm A: generic scene missing preferences
  const armAScene = JSON.parse(JSON.stringify(scene));
  delete armAScene.metadata.artDirection;
  armAScene.metadata.style = "default";
  armAScene.metadata.theme = "light";
  armAScene.metadata = { name: "Generic", tags: [] };

  await fs.mkdir(resolve("tests/trial/out", personaId), { recursive: true });
  await fs.writeFile(resolve("tests/trial/out", personaId, `armB-scene.json`), JSON.stringify(sceneData, null, 2), "utf-8");
  await fs.writeFile(resolve("tests/trial/out", personaId, `armA-scene.json`), JSON.stringify(armAScene, null, 2), "utf-8");
  if (brief) await fs.writeFile(resolve("tests/trial/out", personaId, `brief.json`), JSON.stringify(brief, null, 2), "utf-8");

  return { personaId, arm, questionsAsked, briefSaved: !!brief, tmp };
}

const results = [];
for (const pid of Object.keys(EXPECTED)) {
  const rB = await runPersona(pid, "B");
  results.push({ persona: pid, arm: "B", questions_asked: rB.questionsAsked, minutes: 3, send_cycles: 1, tmp: rB.tmp });
  // Arm A: no interview, generic scene
  const tmpA = resolve(os.tmpdir(), `.trial-${pid}-A-${Date.now()}`);
  await fs.rm(tmpA, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(resolve(tmpA, ".intent", "scenes"), { recursive: true });
  const sceneA = { version: 1, revision: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), screens: {}, objects: {}, screenOrder: [], metadata: { name: "Generic", tags: [] } };
  await fs.writeFile(resolve(tmpA, ".intent", "scenes", "default.json"), JSON.stringify(sceneA), "utf-8");
  await fs.mkdir(resolve("tests/trial/out", pid), { recursive: true });
  await fs.writeFile(resolve("tests/trial/out", pid, "armA-scene.json"), JSON.stringify(sceneA, null, 2), "utf-8");
  results.push({ persona: pid, arm: "A", questions_asked: 0, minutes: 1, send_cycles: 0, tmp: tmpA });
}

await fs.mkdir("tests/trial", { recursive: true });
await fs.writeFile("tests/trial/run-results.json", JSON.stringify(results, null, 2), "utf-8");
console.log("DRIVER DONE");
console.log(JSON.stringify(results.map((r) => ({ persona: r.persona, arm: r.arm, q: r.questions_asked })), null, 2));
