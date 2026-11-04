import { describe, expect, it } from "vitest";
import { toolKind } from "../src/renderer/office/scene/status-badge.js";
import { widgetFor, widgetStep, widgetSteps } from "../src/renderer/office/surfaces/work-widget.js";
import {
  beatEnvelope,
  beatHands,
  type WorkBeat,
  WorkBeats,
  workBeatSeconds,
} from "../src/renderer/office/work-beats.js";

function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/** Runs the beats for `seconds` at 30 frames a second and lists each beat on the frame it starts. */
function run(beats: WorkBeats, seconds: number, atDesk = true, quiet = false): WorkBeat[] {
  const started: WorkBeat[] = [];
  for (let frame = 0; frame < seconds * 30; frame++) {
    const beat = beats.update(1 / 30, atDesk, quiet);
    if (beat !== null && beat.elapsed === 0) {
      started.push(beat.kind);
    }
  }
  return started;
}

describe("work beats at the desk", () => {
  it("breaks up a long stretch of typing every so often, never the same beat twice running", () => {
    // Arrange
    const beats = new WorkBeats(seeded(4));

    // Act: three minutes of typing.
    const started = run(beats, 180);

    // Assert
    expect(started.length).toBeGreaterThanOrEqual(8);
    expect(started.length).toBeLessThanOrEqual(20);
    expect(started.some((kind, index) => index > 0 && kind === started[index - 1])).toBe(false);
    expect(started).not.toContain("fist");
  });

  it("does nothing away from the desk, and starts nothing new while quiet", () => {
    // Arrange
    const away = new WorkBeats(seeded(7));
    const quiet = new WorkBeats(seeded(7));

    // Act
    const awayBeats = run(away, 60, false);
    const quietBeats = run(quiet, 60, true, true);

    // Assert
    expect(awayBeats).toEqual([]);
    expect(quietBeats).toEqual([]);
  });

  it("pumps a fist once the work is done, even while quiet", () => {
    // Arrange
    const beats = new WorkBeats(seeded(9));
    beats.celebrate();

    // Act
    const started = run(beats, 3, true, true);

    // Assert
    expect(started).toEqual(["fist"]);
  });

  it("frees the hands only for the beats that use them", () => {
    // Act + Assert
    expect(beatHands("think")).toEqual({ left: false, right: true });
    expect(beatHands("stretch")).toEqual({ left: true, right: true });
    expect(beatHands("lean")).toEqual({ left: false, right: false });
    expect(beatHands("glance")).toEqual({ left: false, right: false });
  });

  it("eases each beat in and out", () => {
    for (const kind of ["think", "lean", "glance", "stretch", "fist"] as const) {
      // Act
      const length = workBeatSeconds[kind];
      const amounts = [0, length / 2, length].map((elapsed) => beatEnvelope({ kind, elapsed, side: 1 }));

      // Assert
      expect(amounts, kind).toEqual([0, 1, 0]);
    }
  });
});

describe("the badge over a working member", () => {
  it("shows what kind of tool is in use, and thinking before any", () => {
    // Act
    const kinds = ["Edit", "Write", "Bash", "Grep", "Glob", "Read", "WebFetch", "Task", "TodoWrite", "mcp__x__y"].map(
      (tool) => toolKind(tool),
    );

    // Assert
    expect(kinds).toEqual(["edit", "edit", "terminal", "search", "search", "read", "web", "delegate", "plan", "think"]);
    expect(toolKind(null)).toBe("think");
  });
});

describe("the live panel on a working screen", () => {
  it("fits each role's work", () => {
    // Act + Assert
    expect(widgetFor("asuna")).toBe("chart");
    expect(widgetFor("yor")).toBe("deploy");
    expect(widgetFor("erza")).toBe("checklist");
    expect(widgetFor("huagua")).toBe("canvas");
    expect(widgetFor("miruku")).toBe("scan");
    expect(widgetFor("kobayashi")).toBe("tests");
    expect(widgetFor("arisu")).toBe("tasks");
  });

  it("steps through its run and starts over each cycle", () => {
    // Act
    const steps = [0, 3.5, 6.99, 7, 10.5].map((seconds) => widgetStep(seconds));

    // Assert
    expect(steps[0]).toBe(0);
    expect(steps[1]).toBe(widgetSteps / 2);
    expect(steps[2]).toBe(widgetSteps - 1);
    expect(steps[3]).toBe(0);
    expect(steps[4]).toBe(widgetSteps / 2);
  });
});
