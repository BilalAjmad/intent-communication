import type {
  Scene, LocksFile, Config, Profile, InterviewState, Brief, Feedback, Annotation, IntentProfile,
} from "@intent/schema";

export interface StoragePort {
  /**
   * Absolute root directory this port reads and writes under.
   * `createLockPort` derives the lock directories from it, so storage and
   * locks can never point at different roots (see Review Focus #3).
   */
  readonly rootDir: string;
  readScene(sceneId: string): Promise<Scene | null>;
  writeScene(sceneId: string, scene: Scene): Promise<void>;
  readLocks(sceneId: string): Promise<LocksFile>;
  writeLocks(sceneId: string, locksFile: LocksFile): Promise<void>;
  readConfig(): Promise<Config>;
  writeConfig(config: Config): Promise<void>;
  readProfile(): Promise<Profile | null>;
  writeProfile(profile: Profile): Promise<void>;
  /** trd 17.1 Intent Profile (learned preferences); kept separate from the M1 Profile file. */
  readIntentProfile(): Promise<IntentProfile>;
  writeIntentProfile(profile: IntentProfile): Promise<void>;
  readInterviewState(): Promise<InterviewState | null>;
  writeInterviewState(state: InterviewState): Promise<void>;
  readBrief(briefId: string): Promise<Brief | null>;
  writeBrief(brief: Brief): Promise<void>;
  readFeedback(sceneId: string): Promise<Feedback[]>;
  writeFeedback(sceneId: string, feedback: Feedback[]): Promise<void>;
  /**
   * Annotations (trd 9.7). Vector data lives in .intent/annotations/<sceneId>.json;
   * PNGs (created by the browser over a screenshot of the target box) live in
   * .intent/annotations/<sceneId>/<aId>.png. Both are validated strictly; files
   * over 1 MB are rejected.
   */
  readAnnotations(sceneId: string): Promise<Annotation[]>;
  writeAnnotations(sceneId: string, annotations: Annotation[]): Promise<void>;
  writeAnnotationImage(
    sceneId: string,
    annotationId: string,
    png: Buffer,
  ): Promise<{ file: string; width: number; height: number }>;
  readAnnotationImage(sceneId: string, file: string): Promise<Buffer | null>;
  listScenes(): Promise<string[]>;
}

export interface LockPort {
  acquire(sceneId: string, objectId: string): Promise<boolean>;
  release(sceneId: string, objectId: string): Promise<boolean>;
  isLocked(sceneId: string, objectId: string): Promise<boolean>;
  getLockedObjects(sceneId: string): Promise<string[]>;
  acquireSceneLock(sceneId: string): Promise<boolean>;
  releaseSceneLock(sceneId: string): Promise<boolean>;
}

export interface CryptoPort {
  generateId(): string;
  hash(input: string): Promise<string>;
  verify(input: string, hash: string): Promise<boolean>;
}

