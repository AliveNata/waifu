import { describe, expect, it } from "vitest";
import { OfficeLife } from "../src/renderer/office/office-life.js";
import { standupStationIds } from "../src/renderer/office/office-plan.js";
import {
  arrivesAt,
  leavesAt,
  officeDay,
  type RitualNow,
  ritualFor,
  standupClosing,
  standupOpening,
  standupTurn,
  standupTurnSeconds,
} from "../src/renderer/office/office-rituals.js";
import { atJakartaTime } from "../src/renderer/office/office-time.js";
import { type MemberId, memberIds } from "../src/shared/team.js";

const day = new Date("2026-11-02T00:00:00Z");
const at = (hours: number, minutes: number): Date => atJakartaTime(hours, minutes, day);

describe("the office day", () => {
  it("has standup, lunch and going home at their hours, and nothing in between", () => {
    // Act
    const standup = ritualFor("asuna", at(9, 32));
    const morning = ritualFor("asuna", at(10, 30));
    const lunch = ritualFor("asuna", at(12, 10));
    const night = ritualFor("asuna", at(22, 0));
    const early = ritualFor("asuna", at(6, 0));

    // Assert
    expect(standup?.id).toBe("standup");
    expect(morning).toBeNull();
    expect(lunch?.id).toBe("lunch");
    expect(night?.id).toBe("home");
    expect(early?.id).toBe("home");
  });

  it("keeps a member home until their own arrival, across midnight", () => {
    // Arrange: Asuna leaves at 19:25 and comes in at 07:42.
    const arrive = arrivesAt("asuna");

    // Act
    const late = ritualFor("asuna", at(23, 0));

    // Assert: 24 - 23 + arrive hours to go.
    expect(late?.remainingMs).toBeCloseTo((1 + arrive) * 3600 * 1000, -3);
  });

  it("sends 2B home last and brings her in first", () => {
    // Act
    const latest = Math.max(...memberIds.map(leavesAt));
    const earliest = Math.min(...memberIds.map(arrivesAt));

    // Assert
    expect(leavesAt("twob")).toBe(latest);
    expect(arrivesAt("twob")).toBe(earliest);
    expect(ritualFor("ruby", at(19, 30))?.id).toBe("home");
    expect(ritualFor("twob", at(19, 30))).toBeNull();
  });

  it("names the day on Jakarta's calendar, not UTC's", () => {
    // Act: 23:00 UTC is already the next morning in Jakarta.
    const result = officeDay(new Date("2026-11-01T23:00:00Z"));

    // Assert
    expect(result).toBe("2026-11-02");
  });
});

describe("standup turns", () => {
  it("has the lead open, everyone report in order, the lead close, then ends", () => {
    // Arrange
    const attendees: MemberId[] = ["arisu", "asuna", "yor"];
    const turn = (index: number) => standupTurn("arisu", attendees, index * standupTurnSeconds + 0.1, "2026-11-02");

    // Act
    const turns = [0, 1, 2, 3, 4].map(turn);

    // Assert
    expect(turns[0]).toMatchObject({ speaker: "arisu", text: standupOpening });
    expect(turns[1]?.speaker).toBe("asuna");
    expect(turns[2]?.speaker).toBe("yor");
    expect(turns[3]?.speaker).toBe("arisu");
    expect(turns[3]?.text.endsWith(standupClosing)).toBe(true);
    expect(turns[4]).toBeNull();
  });
});

describe("rituals in the office life", () => {
  function lifeWith(ritual: (memberId: MemberId) => RitualNow | null): OfficeLife {
    return new OfficeLife(
      () => 0,
      () => false,
      () => ({ place: "desk", level: 0.5 }),
      () => "pagi",
      () => ({ pieces: 0, canBuy: false }),
      ritual,
    );
  }
  const standup: RitualNow = { id: "standup", remainingMs: 6 * 60 * 1000, day: "2026-11-02" };

  it("puts the PM at the board and the others in the circle, once a day", () => {
    // Arrange
    let now: RitualNow | null = standup;
    const life = lifeWith(() => now);

    // Act
    const lead = life.planFor("arisu", 0);
    const member = life.planFor("asuna", 0);
    now = { ...standup, remainingMs: 1000 };
    const afterwards = life.planFor("asuna", 6 * 60 * 1000 + 1);

    // Assert
    expect(lead).toMatchObject({ activity: "standup", station: standupStationIds[0], action: "standup-lead" });
    expect(member).toMatchObject({ activity: "standup", action: "standup" });
    expect(member.station).not.toBe(standupStationIds[0]);
    expect(afterwards.activity).not.toBe("standup");
  });

  it("cuts a plain desk break short when standup starts", () => {
    // Arrange: a desk break chosen before 09:30.
    let now: RitualNow | null = null;
    const life = lifeWith(() => now);
    const before = life.planFor("yor", 0);
    life.arrived("yor", 0);

    // Act
    now = standup;
    const after = life.planFor("yor", 1000);

    // Assert
    expect(before.activity).toBe("desk");
    expect(after.activity).toBe("standup");
  });

  it("sends everyone home through the same door without holding it", () => {
    // Arrange
    const home: RitualNow = { id: "home", remainingMs: 10 * 3600 * 1000, day: "2026-11-02" };
    const life = lifeWith(() => home);

    // Act
    const first = life.planFor("ruby", 0);
    const second = life.planFor("chizuru", 0);

    // Assert
    expect(first).toMatchObject({ activity: "home", station: "door", errand: "go-home" });
    expect(second).toMatchObject({ activity: "home", station: "door", errand: "go-home" });
    expect(life.occupant("door")).toBeNull();
    expect(first.durationMs).toBe(home.remainingMs);
  });

  it("gives each luncher a seat of their own at the meeting table", () => {
    // Arrange
    const lunch: RitualNow = { id: "lunch", remainingMs: 3600 * 1000, day: "2026-11-02" };
    const life = lifeWith(() => lunch);

    // Act
    const seats = memberIds.map((memberId) => life.planFor(memberId, 0));

    // Assert
    expect(seats.every((choice) => choice.activity === "lunch" && choice.station.startsWith("meeting-"))).toBe(true);
    expect(new Set(seats.map((choice) => choice.station)).size).toBe(memberIds.length);
  });
});
