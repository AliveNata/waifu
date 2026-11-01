import { describe, expect, it } from "vitest";
import { Handoffs, handOverSeconds, maxPendingBriefs, staleHandoffMs } from "../src/renderer/office/handoffs.js";

const handOverMs = handOverSeconds * 1000;

describe("briefs", () => {
  it("sends 2B to each delegated teammate's desk in turn, then back to her own plan", () => {
    // Arrange
    const handoffs = new Handoffs();
    handoffs.delegated("arisu", 0);
    handoffs.delegated("komachi", 10);

    // Act + Assert: Arisu first, carrying the brief.
    expect(handoffs.planFor("twob")).toEqual({ station: "visit-arisu", action: "hand-over", carrying: true });
    handoffs.arrived("twob", "visit-arisu", 5_000);
    handoffs.update(5_000 + handOverMs - 1);
    expect(handoffs.planFor("twob")?.station).toBe("visit-arisu");
    handoffs.update(5_000 + handOverMs);
    expect(handoffs.planFor("twob")?.station).toBe("visit-komachi");
    handoffs.arrived("twob", "visit-komachi", 12_000);
    handoffs.update(12_000 + handOverMs);
    expect(handoffs.planFor("twob")).toBeNull();
  });

  it("starts the handover timer only once 2B is at the right desk", () => {
    // Arrange
    const handoffs = new Handoffs();
    handoffs.delegated("asuna", 0);

    // Act: arriving somewhere else does not count.
    handoffs.arrived("twob", "visit-yor", 1_000);
    handoffs.update(1_000 + handOverMs);

    // Assert
    expect(handoffs.planFor("twob")?.station).toBe("visit-asuna");
  });

  it("delivers a few briefs at most, and none twice", () => {
    // Arrange
    const handoffs = new Handoffs();
    const team = ["arisu", "komachi", "kobayashi", "asuna", "yor"] as const;

    // Act
    for (const member of team) {
      handoffs.delegated(member, 0);
    }
    handoffs.delegated("arisu", 0);

    // Assert: count the stations 2B is sent to before her queue runs dry.
    const visited: string[] = [];
    let now = 0;
    for (let plan = handoffs.planFor("twob"); plan !== null; plan = handoffs.planFor("twob")) {
      visited.push(plan.station);
      handoffs.arrived("twob", plan.station, now);
      now += handOverMs;
      handoffs.update(now);
    }
    expect(visited).toEqual(team.slice(0, maxPendingBriefs).map((member) => `visit-${member}`));
  });

  it("drops a brief 2B never managed to deliver", () => {
    // Arrange
    const handoffs = new Handoffs();
    handoffs.delegated("erza", 0);

    // Act
    handoffs.update(staleHandoffMs);

    // Assert
    expect(handoffs.planFor("twob")).toBeNull();
  });
});

describe("reports", () => {
  it("lines reporters up in front of 2B's desk in the order they finished", () => {
    // Arrange
    const handoffs = new Handoffs();
    handoffs.finished("kobayashi", 0);
    handoffs.finished("erza", 100);

    // Act + Assert
    expect(handoffs.planFor("kobayashi")).toEqual({ station: "report-1", action: "hand-over", carrying: true });
    expect(handoffs.planFor("erza")).toEqual({ station: "report-2", action: "wait-report", carrying: true });
  });

  it("moves the next reporter up once the first has handed over", () => {
    // Arrange
    const handoffs = new Handoffs();
    handoffs.finished("kobayashi", 0);
    handoffs.finished("erza", 100);
    handoffs.arrived("kobayashi", "report-1", 4_000);
    handoffs.arrived("erza", "report-2", 4_500);

    // Act
    handoffs.update(4_000 + handOverMs);

    // Assert
    expect(handoffs.planFor("kobayashi")).toBeNull();
    expect(handoffs.planFor("erza")).toEqual({ station: "report-1", action: "hand-over", carrying: true });
  });

  it("keeps a waiting reporter in line until they move up, however long the one ahead takes", () => {
    // Arrange
    const handoffs = new Handoffs();
    handoffs.finished("kobayashi", 0);
    handoffs.finished("erza", 0);
    handoffs.arrived("erza", "report-2", 1_000);

    // Act: well past a handover, but Kobayashi has not reached the front spot yet.
    handoffs.update(10_000);

    // Assert
    expect(handoffs.planFor("erza")?.station).toBe("report-2");
  });

  it("forgets the report when the teammate gets a new task first", () => {
    // Arrange
    const handoffs = new Handoffs();
    handoffs.finished("asuna", 0);

    // Act
    handoffs.delegated("asuna", 500);

    // Assert
    expect(handoffs.planFor("asuna")).toBeNull();
  });

  it("turns 2B and the reporter toward each other only while handing over", () => {
    // Arrange
    const handoffs = new Handoffs();
    handoffs.finished("ruby", 0);

    // Act + Assert
    expect(handoffs.partnerOf("twob")).toBeNull();
    handoffs.arrived("ruby", "report-1", 3_000);
    expect(handoffs.partnerOf("twob")).toBe("ruby");
    expect(handoffs.partnerOf("ruby")).toBe("twob");
  });
});
