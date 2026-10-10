import { describe, expect, it } from "vitest";
import { Conversation, lineDurationMs, toolLine, visemeWeights } from "../src/renderer/common/conversation.js";
import { speakerPose } from "../src/renderer/team-overlay/team-overlay-pose.js";
import type { CompanionSignal, MemberSignal } from "../src/shared/reaction.js";

function member(
  activity: MemberSignal["activity"],
  receivedAt: number,
  extra: Partial<MemberSignal> = {},
): CompanionSignal {
  return {
    kind: "member",
    member: { memberId: "asuna", activity, agentId: "a", tool: null, summary: null, receivedAt, ...extra },
  };
}

const delegation: CompanionSignal = {
  kind: "delegation",
  delegation: { memberId: "asuna", description: "Perbaiki model dbt", receivedAt: 0 },
};

describe("Conversation", () => {
  it("has 2B hand over the task, then the member answers", () => {
    // Arrange
    const conversation = new Conversation(() => 0);

    // Act
    conversation.handle(delegation, "simulated");
    conversation.handle(member("start", 1), "simulated");
    const first = conversation.current(0);
    const second = conversation.current(lineDurationMs(first?.line ?? ({ text: "" } as never)) + 1);

    // Assert
    expect(first?.line).toMatchObject({
      memberId: "twob",
      text: "Asuna, tolong bantu ya.",
      simulated: true,
      gesture: "point",
    });
    expect(second?.line).toMatchObject({ memberId: "asuna", text: "Oke, aku cek pipeline datanya.", simulated: true });
  });

  it("uses the real task title and report summary only in real mode", () => {
    // Arrange
    const conversation = new Conversation(() => 0);

    // Act
    conversation.handle(delegation, "real");
    conversation.handle(member("start", 1), "real");
    conversation.handle(member("stop", 2, { summary: "Model diperbaiki, 3 test ditambah." }), "real");
    const texts: string[] = [];
    let now = 0;
    for (let index = 0; index < 3; index++) {
      const current = conversation.current(now);
      texts.push(current?.line.text ?? "");
      now += lineDurationMs(current?.line ?? ({ text: "" } as never)) + 1;
    }

    // Assert
    expect(texts).toEqual([
      "Asuna, tolong: Perbaiki model dbt",
      "Siap. Perbaiki model dbt",
      "Model diperbaiki, 3 test ditambah.",
    ]);
  });

  it("falls back to simulated lines in real mode when there is nothing real to show", () => {
    // Arrange
    const conversation = new Conversation(() => 0);

    // Act
    conversation.handle(member("stop", 2), "real");

    // Assert
    expect(conversation.current(0)?.line).toMatchObject({ simulated: true, mood: "done" });
  });

  it("throttles tool lines per member", () => {
    // Arrange
    const conversation = new Conversation(() => 0);

    // Act
    conversation.handle(member("tool", 0, { tool: "Read" }), "simulated");
    conversation.handle(member("tool", 1000, { tool: "Edit" }), "simulated");
    conversation.handle(member("tool", 9000, { tool: "Edit" }), "simulated");

    // Assert
    expect(conversation.current(0)?.line.text).toBe("Aku baca kodenya dulu.");
    expect(conversation.pendingCount()).toBe(1);
  });

  it("is quiet when nothing has been said", () => {
    expect(new Conversation().current(0)).toBeNull();
  });
});

describe("toolLine", () => {
  it("keeps Yor's commands read-only in what she says", () => {
    expect(toolLine("yor", "Bash").text).toBe("Jalanin command read-only dulu.");
    expect(toolLine("asuna", "Bash").text).toBe("Aku jalanin command-nya.");
  });
});

describe("visemeWeights", () => {
  it("opens the mouth into the vowel just revealed", () => {
    expect(visemeWeights("halo", 2)).toMatchObject({ aa: 0.9 });
    expect(visemeWeights("halo", 4)).toMatchObject({ oh: 0.9 });
  });

  it("keeps a small opening on consonants and closes on spaces", () => {
    expect(visemeWeights("hi there", 1).aa).toBe(0.3);
    expect(Object.values(visemeWeights("hi there", 3)).every((weight) => weight === 0)).toBe(true);
  });
});

describe("speakerPose", () => {
  it("raises the right arm toward the viewer while pointing, then lowers it", () => {
    // Act
    const pointing = speakerPose({ gesture: "point", lineElapsed: 0.5, time: 0, talking: true });
    const after = speakerPose({ gesture: "point", lineElapsed: 3, time: 0, talking: false });

    // Assert
    expect(pointing.bones.rightUpperArm?.x).toBeCloseTo(-1.0);
    expect(after.bones.rightUpperArm?.z).toBeCloseTo(1.22);
  });

  it("lifts both arms for a cheer", () => {
    const cheer = speakerPose({ gesture: "cheer", lineElapsed: 0.2, time: 0, talking: true });
    expect(cheer.bones.leftUpperArm?.z).toBeGreaterThan(0.8);
    expect(cheer.bones.rightUpperArm?.z).toBeLessThan(-0.8);
  });
});
