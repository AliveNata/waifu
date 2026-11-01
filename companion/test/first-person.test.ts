import { describe, expect, it } from "vitest";
import { waveAmount, waveSeconds } from "../src/renderer/office/alyx-hands.js";
import { type AlyxTarget, pickableItems, pickTarget } from "../src/renderer/office/alyx-targets.js";
import { bossLine, bossLineCount } from "../src/renderer/office/boss-greetings.js";
import {
  hurryMultiplier,
  lookWalker,
  maxLookPitch,
  startView,
  stepWalker,
  strollSpeed,
  type WalkerView,
} from "../src/renderer/office/first-person.js";
import { OfficeLife } from "../src/renderer/office/office-life.js";
import { navGrid } from "../src/renderer/office/office-nav.js";
import { memberIds } from "../src/shared/team.js";

const origin: WalkerView = { x: 0, z: 0, yaw: 0, pitch: 0 };
const anywhere = (): boolean => true;

describe("walking as Alyx", () => {
  it("walks straight ahead along -z when facing the default way", () => {
    // Act
    const after = stepWalker(origin, { forward: 1, right: 0, fast: false }, 1, anywhere);

    // Assert
    expect(after.x).toBeCloseTo(0, 6);
    expect(after.z).toBeCloseTo(-strollSpeed, 6);
  });

  it("goes no faster diagonally, and faster with Shift", () => {
    // Act
    const diagonal = stepWalker(origin, { forward: 1, right: 1, fast: false }, 1, anywhere);
    const hurried = stepWalker(origin, { forward: 1, right: 0, fast: true }, 1, anywhere);

    // Assert
    expect(Math.hypot(diagonal.x, diagonal.z)).toBeCloseTo(strollSpeed, 6);
    expect(-hurried.z).toBeCloseTo(strollSpeed * hurryMultiplier, 6);
  });

  it("slides along a wall instead of stopping dead", () => {
    // Arrange: nothing may go past z = -0.1, as if a desk edge ran along x.
    const wall = (point: { x: number; z: number }): boolean => point.z > -0.1;

    // Act: walking diagonally forward and right into it.
    const after = stepWalker(origin, { forward: 1, right: 1, fast: false }, 0.5, wall);

    // Assert: kept the sideways part, dropped the part into the wall.
    expect(after.z).toBe(0);
    expect(after.x).toBeGreaterThan(0.3);
  });

  it("stays put when every way is blocked", () => {
    // Act
    const after = stepWalker(origin, { forward: 1, right: 0, fast: false }, 1, () => false);

    // Assert
    expect(after).toEqual(origin);
  });

  it("looks right for a mouse move right and never flips over", () => {
    // Act
    const turned = lookWalker(origin, 100, 0);
    const up = lookWalker(origin, 0, -100_000);

    // Assert: yaw grows to the left, so turning right makes it negative.
    expect(turned.yaw).toBeLessThan(0);
    expect(up.pitch).toBe(maxLookPitch);
  });

  it("walks in on open floor just inside the door", () => {
    // Act
    const free = navGrid.isFree({ x: startView.x, z: startView.z });

    // Assert
    expect(free).toBe(true);
  });
});

describe("greeting the boss", () => {
  it("gives everyone something of their own to say", () => {
    for (const memberId of memberIds) {
      expect(bossLineCount(memberId)).toBeGreaterThan(1);
    }
  });

  it("says the time of day only sometimes, and 2B keeps it formal", () => {
    // Arrange: the first draw picks the line, the second decides about the hello.
    const draws = (...values: number[]) => {
      let index = 0;
      return () => values[index++ % values.length] ?? 0;
    };

    // Act
    const withHello = bossLine("chizuru", "pagi", draws(0, 0.9));
    const without = bossLine("chizuru", "pagi", draws(0, 0.1));
    const twob = bossLine("twob", "pagi", draws(0, 0.9));

    // Assert
    expect(withHello.startsWith("Pagi! ")).toBe(true);
    expect(without.startsWith("Pagi")).toBe(false);
    expect(twob.startsWith("Pak Alyx")).toBe(true);
  });
});

describe("Alyx's wave", () => {
  it("rises, holds and comes back down within the wave", () => {
    // Act
    const values = [-0.1, 0, waveSeconds / 2, waveSeconds, waveSeconds + 0.1].map(waveAmount);

    // Assert
    expect(values[0]).toBe(0);
    expect(values[1]).toBe(0);
    expect(values[2]).toBe(1);
    expect(values[3]).toBe(0);
    expect(values[4]).toBe(0);
  });
});

describe("what E is aimed at", () => {
  const eye = { x: 0, y: 1.15, z: 0 };
  const target = (id: string, x: number, z: number, reach = 2): AlyxTarget => ({
    id,
    label: id,
    point: { x, y: 1, z },
    reach,
  });
  // A stand-in camera: one meter to the side is 100 px on screen, and only -z is in front.
  const project = (point: AlyxTarget["point"]) => ({ dx: point.x * 100, dy: 0, inFront: point.z < 0 });

  it("picks the target nearest the aim dot", () => {
    // Act
    const picked = pickTarget([target("left", -0.5, -1), target("ahead", 0.1, -1)], eye, project);

    // Assert
    expect(picked?.id).toBe("ahead");
  });

  it("ignores what is out of reach, behind him, or far off the aim dot", () => {
    // Act
    const picked = pickTarget(
      [target("far", 0, -5, 1.5), target("behind", 0, 1), target("aside", 2, -1)],
      eye,
      project,
    );

    // Assert
    expect(picked).toBeNull();
  });

  it("names only the desk things that can be picked up", () => {
    // Assert: things fixed in place or tied to another bit stay out.
    expect(pickableItems.stamp).toBe("stempel");
    expect(pickableItems["security-key"]).toBeUndefined();
    expect(pickableItems["chess-piece"]).toBeUndefined();
  });
});

describe("ping-pong against Alyx", () => {
  it("brings the teammate idle the longest to the other end, for as long as he plays", () => {
    // Arrange: two teammates on desk breaks, Ruby's from earlier.
    const life = new OfficeLife(() => 0);
    life.planFor("ruby", 0);
    life.planFor("yor", 1000);

    // Act
    const partner = life.playBoss("pingpong-east", 2000);
    life.arrived("ruby", 3000);
    const stillPlaying = life.planFor("ruby", 10 * 60 * 1000);

    // Assert: no other player at the table, and still the game ten minutes on.
    expect(partner).toBe("ruby");
    expect(stillPlaying).toMatchObject({ activity: "pingpong", station: "pingpong-east" });
    expect(life.occupant("pingpong-east")).toBe("ruby");
  });

  it("lets the opponent go back to their routine when he stops", () => {
    // Arrange
    const life = new OfficeLife(() => 0);
    life.planFor("ruby", 0);
    life.playBoss("pingpong-east", 1000);

    // Act
    life.endBossGame("ruby", 2000);
    const next = life.planFor("ruby", 2001);

    // Assert
    expect(next.activity).not.toBe("pingpong");
    expect(life.occupant("pingpong-east")).toBeNull();
  });

  it("finds no opponent when nobody is on a break", () => {
    // Act
    const partner = new OfficeLife(() => 0).playBoss("pingpong-east", 0);

    // Assert
    expect(partner).toBeNull();
  });
});
