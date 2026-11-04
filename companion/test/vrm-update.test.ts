import { describe, expect, it } from "vitest";
import { springSteps } from "../src/renderer/common/vrm-update.js";

describe("springSteps", () => {
  it("takes one step at a normal frame rate", () => {
    // Act
    const steps = springSteps(1 / 60);

    // Assert
    expect(steps.count).toBe(1);
    expect(steps.seconds).toBeCloseTo(1 / 60, 6);
  });

  it("splits a 30 fps frame in two small steps", () => {
    // Act
    const steps = springSteps(1 / 30);

    // Assert
    expect(steps.count).toBe(2);
    expect(steps.seconds).toBeCloseTo(1 / 60, 6);
  });

  it("never takes more than two steps or a step longer than 1/40 s on a slow frame", () => {
    // Act
    const steps = springSteps(0.1);

    // Assert
    expect(steps.count).toBe(2);
    expect(steps.seconds).toBeCloseTo(1 / 40, 6);
  });
});
