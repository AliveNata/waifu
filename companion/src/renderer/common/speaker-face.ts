import type { Mood } from "../../shared/reaction.js";
import { allVisemes, type DialogLine, visemeWeights } from "./conversation.js";
import { BlinkScheduler, type ExpressionWeights, stepExpressionWeights } from "./expressions.js";
import { type Tone, toneExpressions } from "./report-lines.js";

/**
 * Softer than the 2B overlay's mood expressions: VRoid's "happy" closes the eyes,
 * which looks odd for someone mid-sentence.
 */
export const dialogExpressions: Record<Mood, ExpressionWeights> = {
  idle: {},
  greeting: { happy: 0.3 },
  thinking: { relaxed: 0.25 },
  working: { relaxed: 0.1 },
  waiting: { surprised: 0.3 },
  done: { happy: 0.55 },
};

/** Between sentences: a faint smile instead of a blank stare. */
const restingFace: ExpressionWeights = { happy: 0.08, relaxed: 0.12 };

/**
 * VRoid face parts, written straight to the morph targets. VRoid's presets are whole-face
 * ("sad" also droops the eyelids, "happy" closes the eyes), so on VRoid models the feeling
 * goes into the brows and eyes separately and the presets stay faint.
 */
export const faceParts = [
  "Fcl_BRW_Angry",
  "Fcl_BRW_Fun",
  "Fcl_BRW_Joy",
  "Fcl_BRW_Sorrow",
  "Fcl_BRW_Surprised",
  "Fcl_EYE_Sorrow",
  "Fcl_EYE_Surprised",
  "Fcl_EYE_Spread",
] as const;
export type FacePart = (typeof faceParts)[number];

const tonePartFaces: Record<Tone, ExpressionWeights> = {
  positive: { happy: 0.2, Fcl_BRW_Joy: 0.5 },
  concern: { sad: 0.1, Fcl_BRW_Sorrow: 0.75, Fcl_EYE_Sorrow: 0.12 },
  suggestion: { relaxed: 0.08, Fcl_BRW_Fun: 0.45 },
  question: { Fcl_BRW_Surprised: 0.6, Fcl_EYE_Surprised: 0.2 },
  // Inner brows up and pulled together: the "hmm, not sure" look.
  confused: { Fcl_BRW_Sorrow: 0.45, Fcl_BRW_Angry: 0.2, Fcl_EYE_Spread: 0.15 },
  neutral: { Fcl_BRW_Fun: 0.12 },
};

const moodPartFaces: Record<Mood, ExpressionWeights> = {
  idle: {},
  greeting: { happy: 0.15, Fcl_BRW_Joy: 0.4 },
  thinking: { Fcl_BRW_Angry: 0.15, Fcl_BRW_Sorrow: 0.15 },
  working: { Fcl_BRW_Fun: 0.15 },
  waiting: { Fcl_BRW_Surprised: 0.4 },
  done: { happy: 0.3, Fcl_BRW_Joy: 0.5 },
};

const restingPartFace: ExpressionWeights = { happy: 0.05, Fcl_BRW_Fun: 0.15 };

/** Every name the face writes, so a weight that eased to zero is written as zero instead of left behind. */
const presetNames: readonly string[] = ["happy", "angry", "sad", "relaxed", "surprised", ...allVisemes()];

/**
 * People look away while they search for words: up and to the side when unsure or asking,
 * down for a moment before bad news. Offsets are in meters at the viewer's distance.
 */
const glances: Partial<Record<Tone, { x: number; y: number; seconds: number }>> = {
  question: { x: 0.3, y: 0.22, seconds: 0.9 },
  confused: { x: -0.38, y: 0.28, seconds: 1.5 },
  concern: { x: 0.08, y: -0.22, seconds: 0.7 },
  suggestion: { x: 0.2, y: 0.12, seconds: 0.5 },
};

/** How long an emotion takes to build at the start of a sentence. */
const emotionRampSeconds = 0.5;
/** Once the sentence is said the feeling lingers, a little weaker, until the next line. */
const afterglow = 0.75;

export interface FaceInput {
  line: DialogLine | null;
  /** Seconds since the line started. */
  lineElapsed: number;
  /** Characters of the line already revealed. */
  revealed: number;
  talking: boolean;
}

export interface FaceFrame {
  /** VRM expression weights: emotions, mouth shapes and blink. */
  expressions: Record<string, number>;
  /** Where the eyes look, as an offset from straight at the viewer. */
  gaze: { x: number; y: number };
}

/** A stable 0..1 value per character, so the mouth opens a bit more or less on each vowel. */
function mouthVariation(index: number): number {
  const hashed = Math.sin(index * 12.9898) * 43758.5453;
  return hashed - Math.floor(hashed);
}

function scaled(weights: ExpressionWeights, factor: number): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [name, weight] of Object.entries(weights)) {
    result[name] = weight * factor;
  }
  return result;
}

/**
 * The speaker's face over time: emotion from the sentence, lip shapes from the
 * text being revealed, blinks with a human rhythm, and eyes that wander a little.
 * `random` is injectable so tests are deterministic.
 */
export class SpeakerFace {
  private weights: Record<string, number> = {};
  private readonly blink: BlinkScheduler;
  private saccade = { x: 0, y: 0 };
  private nextSaccadeAt = 0;
  private wasTalking = false;
  private parts = false;

  constructor(private readonly random: () => number = Math.random) {
    this.blink = new BlinkScheduler(random);
  }

  /**
   * For a new speaker: no leftover expression from the previous face. `hasFaceParts` is true
   * when the model has VRoid's separate brow and eye morphs.
   */
  reset(hasFaceParts = false): void {
    this.weights = {};
    this.wasTalking = false;
    this.parts = hasFaceParts;
  }

  update(input: FaceInput, time: number, delta: number): FaceFrame {
    const { line, lineElapsed, revealed, talking } = input;
    if (this.wasTalking && !talking) {
      // Finishing a sentence is when people blink.
      this.blink.blinkSoon(time);
    }
    this.wasTalking = talking;

    const base = this.baseFace(line);
    const envelope = line === null ? 1 : talking ? Math.min(1, lineElapsed / emotionRampSeconds) : afterglow;
    const targets = scaled(base, envelope);
    if (talking && line !== null) {
      const mouth = visemeWeights(line.text, revealed);
      const openness = 0.7 + 0.3 * mouthVariation(revealed);
      for (const [viseme, weight] of Object.entries(mouth)) {
        if (weight > 0) {
          targets[viseme] = weight * openness;
        }
      }
    }
    this.weights = stepExpressionWeights(this.weights, targets, delta, 12);

    const expressions: Record<string, number> = {};
    for (const name of this.parts ? [...presetNames, ...faceParts] : presetNames) {
      expressions[name] = this.weights[name] ?? 0;
    }
    // A smile already narrows VRoid eyes; a full blink on top would squeeze them shut.
    expressions.blink = this.blink.weightAt(time) * (1 - (expressions.happy ?? 0));

    return { expressions, gaze: this.gaze(line, lineElapsed, talking, time) };
  }

  private baseFace(line: DialogLine | null): ExpressionWeights {
    if (line === null) {
      return this.parts ? restingPartFace : restingFace;
    }
    if (line.tone !== null) {
      return this.parts ? tonePartFaces[line.tone] : toneExpressions[line.tone];
    }
    return this.parts ? moodPartFaces[line.mood] : dialogExpressions[line.mood];
  }

  private gaze(line: DialogLine | null, lineElapsed: number, talking: boolean, time: number): { x: number; y: number } {
    if (time >= this.nextSaccadeAt) {
      // Small jumps while talking to someone, wider ones while idle and looking around.
      const reach = talking ? 0.04 : 0.14;
      this.saccade = { x: (this.random() - 0.5) * 2 * reach, y: (this.random() - 0.5) * reach };
      this.nextSaccadeAt = time + 0.5 + this.random() * (talking ? 1.2 : 2.2);
    }
    const glance = line === null || line.tone === null ? undefined : glances[line.tone];
    if (glance === undefined || lineElapsed >= glance.seconds) {
      return this.saccade;
    }
    // Hold the glance, then ease back to the viewer over its last third.
    const back = Math.max(0, (lineElapsed - glance.seconds * 0.66) / (glance.seconds * 0.34));
    const away = 1 - back;
    return { x: this.saccade.x + glance.x * away, y: this.saccade.y + glance.y * away };
  }
}
