export {
  createStoragePort,
  createLockPort,
  createCryptoPort,
} from "./ports.js";
export type { StoragePort, LockPort, CryptoPort } from "./ports.js";

export { IntentError, ErrorCodes, isIntentError } from "./error.js";
export type { ErrorCode } from "./error.js";

export { assertSafeId, MAX_ID_LENGTH } from "./paths.js";

export type { WriteResult, NormalizeResult } from "./types.js";

export { normalizeScene } from "./normalize.js";

export {
  INTERVIEW_SEEDS,
  DEEP_DIVE_SEEDS,
  CONTROL_SEEDS,
  ALL_SEEDS,
  validateBank,
} from "./interview/bank.js";
export type { Seed, ControlSeed } from "./interview/bank.js";

export { applyPatch } from "./patch.js";
export { createObject, deleteObject, newObjectId } from "./scene-edit.js";
export type { CreateObjectResult, DeleteObjectResult } from "./scene-edit.js";
export { computeAcceptanceRate } from "./metrics.js";
export type { AcceptanceMetricsInput, AcceptanceMetrics, AppliedPatchRef } from "./metrics.js";
export { detectSignals, mergeSignals, summarizeProfile, preFilledForTopic, answerText, recordAnswerLearning } from "./intent-profile.js";
export type { PreferenceSignal } from "./intent-profile.js";

export { writePipeline } from "./pipeline.js";
export { writeAtomic } from "./atomic.js";
export { registerMigration, applyMigrations, checkDocumentVersion, documentVersion } from "./migrations.js";
export { recordInterviewMetrics, summarizeInterviewMetrics } from "./interview-metrics.js";
export type { InterviewMetricsInput, InterviewEfficiencyReport } from "./interview-metrics.js";
export { pruneConsumedAnswers } from "./answers.js";
export { buildApprovedBrief, approveInterview, newBriefId } from "./interview/brief.js";
export type { BuildBriefOptions } from "./interview/brief.js";
export { withProjectLock } from "./projectLock.js";

export { SCHEMA_VERSION, SCENE_SCHEMA_VERSION } from "@intent/schema";
