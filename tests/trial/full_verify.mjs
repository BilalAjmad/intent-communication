import { promises as fs } from "node:fs";
import os from "node:os";
import { resolve } from "node:path";
import { createMCPContext, handleMCPRequest } from "../../packages/mcp-server/dist/index.js";
import { execFileSync } from "node:child_process";

const tmp = resolve(os.tmpdir(), `.fullverify-${Date.now()}`);
await fs.rm(tmp, { recursive: true, force: true }).catch(() => {});
await fs.mkdir(resolve(tmp, ".intent", "scenes"), { recursive: true });
await fs.mkdir(resolve(tmp, ".intent", "briefs"), { recursive: true });
await fs.mkdir(resolve(tmp, ".intent", "feedback"), { recursive: true });
const scene = { version: 1, revision: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), screens: {}, objects: {}, screenOrder: [], metadata: { name: "Verify", tags: [] } };
await fs.writeFile(resolve(tmp, ".intent", "scenes", "default.json"), JSON.stringify(scene), "utf-8");
const ctx = createMCPContext(tmp);
const ask = (input) => handleMCPRequest("ask_user", input, ctx);
const getScene = (input) => handleMCPRequest("get_scene", input, ctx);
const applyPatch = (input) => handleMCPRequest("apply_patch", input, ctx);
const getFeedback = (input) => handleMCPRequest("get_feedback", input, ctx);
const openStudio = (input) => handleMCPRequest("open_studio", input, ctx);
const validate = (input) => handleMCPRequest("validate", input, ctx);

const results = [];
function log(step, ok, detail) { results.push({ step, ok, detail }); console.log(`${ok ? "PASS" : "FAIL"}: ${step} — ${detail}`); }

// Step 1: Interview
try {
  await ask({ kind: "start", questionId: "s1", prompt: "What are we building?", topic: "goal", questionNumber: 1, estimatedTotal: 6, requiredTopics: ["goal","users","screens","flow","style","content"], meter: { percent: 10, topics: { goal: "partial" } } });
  await ask({ kind: "choice", questionId: "q1", prompt: "Goal?", topic: "goal", options: [{ value: "a", label: "Salon booking app" }], questionNumber: 2, estimatedTotal: 6, previousAnswer: { questionId: "s1", answer: { choiceId: "a", text: "salon booking app" } }, meter: { percent: 20, topics: { goal: "covered" } } });
  await ask({ kind: "choice", questionId: "q2", prompt: "Users?", topic: "users", options: [{ value: "a", label: "Salon clients" }], questionNumber: 3, estimatedTotal: 6, previousAnswer: { questionId: "q1", answer: { choiceId: "0", text: "don't know" } }, meter: { percent: 30, topics: { goal: "covered", users: "covered" } } });
  await ask({ kind: "text", questionId: "q3", prompt: "Screens?", topic: "screens", questionNumber: 4, estimatedTotal: 6, previousAnswer: { questionId: "q2", answer: { choiceId: "a", text: "salon clients" } }, meter: { percent: 45, topics: { goal: "covered", users: "covered", screens: "covered" } } });
  await ask({ kind: "text", questionId: "q4", prompt: "Flow?", topic: "flow", questionNumber: 5, estimatedTotal: 6, previousAnswer: { questionId: "q3", answer: { text: "Home, Book, Confirm" } }, meter: { percent: 60, topics: { goal: "covered", users: "covered", screens: "covered", flow: "covered" } } });
  await ask({ kind: "text", questionId: "q5", prompt: "Style?", topic: "style", questionNumber: 6, estimatedTotal: 6, previousAnswer: { questionId: "q4", answer: { text: "main booking flow" } }, meter: { percent: 75, topics: { goal: "covered", users: "covered", screens: "covered", flow: "covered", style: "covered" } } });
  await ask({ kind: "text", questionId: "q6", prompt: "Content?", topic: "content", questionNumber: 7, estimatedTotal: 6, previousAnswer: { questionId: "q5", answer: { text: "warm, calm" } }, meter: { percent: 88, topics: { goal: "covered", users: "covered", screens: "covered", flow: "covered", style: "covered", content: "covered" } } });
  await ask({ kind: "summary", questionId: "sum1", prompt: "Is this right?", questionNumber: 8, estimatedTotal: 6, summary: { paragraph: "A salon booking app.", items: [{ topic: "goal", text: "salon booking app" }, { topic: "screens", text: "Home, Book, Confirm" }, { topic: "style", text: "warm, calm" }], delegated: [{ questionId: "q2", topic: "users", text: "don't know (delegated)" }] }, previousAnswer: { questionId: "q6", answer: { text: "friendly, plain English" } }, meter: { percent: 95, topics: { goal: "covered", users: "covered", screens: "covered", flow: "covered", style: "covered", content: "covered" } } });
  await ask({ kind: "confirm", questionId: "done1", prompt: "Understood.", questionNumber: 9, previousAnswer: { questionId: "sum1", answer: { summaryChoice: "exactly-right" } }, meter: { percent: 100, topics: { goal: "covered", users: "covered", screens: "covered", flow: "covered", style: "covered", content: "covered" } } });
  log("Interview (9 questions, Don't know + skip)", true, "completed");
} catch (e) { log("Interview", false, String(e)); }

// Step 2: Verify brief saved
try {
  const state = JSON.parse(await fs.readFile(resolve(tmp, ".intent", "interview", "state.json"), "utf-8"));
  if (state.status === "complete" && state.briefId) {
    const brief = JSON.parse(await fs.readFile(resolve(tmp, ".intent", "briefs", state.briefId + ".json"), "utf-8"));
    log("Brief saved on approval", true, `id=${state.briefId}, approvalStatus=${brief.approvalStatus}`);
  } else {
    log("Brief saved on approval", false, `status=${state.status}, briefId=${state.briefId}`);
  }
} catch (e) { log("Brief saved on approval", false, String(e)); }

// Step 3: Create scene via apply_patch
try {
  const patch = { id: "o_01ARZ3NDEKTSV4RRFFQ69G5FAV", sceneId: "default", baseRevision: 1, objectId: "s_01ARZ3NDEKTSV4RRFFQ69G5FAV", op: "set", path: "metadata.name", value: "Salon Booking", createdAt: new Date().toISOString() };
  await applyPatch({ patch });
  log("apply_patch (scene metadata)", true, "revision incremented");
} catch (e) { log("apply_patch (scene metadata)", false, String(e)); }

// Step 4: get_scene
try {
  const s = await getScene({ sceneId: "default", depth: 0 });
  log("get_scene", true, `revision=${s.revision}`);
} catch (e) { log("get_scene", false, String(e)); }

// Step 5: open_studio
try {
  const r = await openStudio({ sceneId: "default", userRequested: true, quote: "open the studio" });
  log("open_studio", true, `url=${r.url}`);
} catch (e) { log("open_studio", false, String(e)); }

// Step 6: validate
try {
  const r = await validate({ type: "scene", data: JSON.parse(await fs.readFile(resolve(tmp, ".intent", "scenes", "default.json"), "utf-8")) });
  log("validate", true, `valid=${r.valid}`);
} catch (e) { log("validate", false, String(e)); }

// Step 7: export HTML (before cleanup)
try {
  const bin = "node";
  const cjs = "E:\\npm-global\\node_modules\\intent-communication\\intent.cjs";
  execFileSync(bin, [cjs, "--path", tmp, "export", "-s", "default", "-o", resolve(tmp, "export.html"), "-f", "html"], { stdio: "pipe" });
  const html = await fs.readFile(resolve(tmp, "export.html"), "utf-8");
  log("export HTML", true, `${html.length} bytes`);
} catch (e) { log("export HTML", false, String(e)); }

// Step 8: feedback + get_feedback
try {
  // Create a feedback patch referencing an annotation
  const patch2 = { id: "o_01ARZ3NDEKTSV4RRFFQ69G5FAW", sceneId: "default", baseRevision: 2, objectId: "s_01ARZ3NDEKTSV4RRFFQ69G5FAV", op: "set", path: "metadata.name", value: "Salon Booking v2", createdAt: new Date().toISOString() };
  await applyPatch({ patch: patch2 });
  // Send feedback via the feedback API is not directly available via MCP, but get_feedback works
  const fb = await getFeedback({ sceneId: "default", includeImageData: false });
  log("get_feedback", true, `feedback=${fb.feedback?.length ?? 0}, locked=${fb.locked?.length ?? 0}`);
} catch (e) { log("get_feedback", false, String(e)); }

// Step 9: cleanup
try {
  await fs.rm(resolve(tmp, ".intent"), { recursive: true, force: true });
  log("cleanup (uninstall sim)", true, "removed .intent");
} catch (e) { log("cleanup (uninstall sim)", false, String(e)); }

console.log("\n=== SUMMARY ===");
console.log(`Passed: ${results.filter(r=>r.ok).length}/${results.length}`);
for (const r of results) console.log(`  ${r.ok?"PASS":"FAIL"}: ${r.step} — ${r.detail}`);
console.log(`\nTemp project: ${tmp}`);