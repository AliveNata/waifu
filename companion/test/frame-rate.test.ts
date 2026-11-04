import { describe, expect, it } from "vitest";
import { FrameRate, frameLabel, gpuLabel, paceFrame } from "../src/renderer/office/frame-rate.js";

describe("FrameRate", () => {
  it("reads 0 until there are two frames to compare", () => {
    // Arrange
    const rate = new FrameRate();

    // Act
    rate.tick(1000);

    // Assert
    expect(rate.fps()).toBe(0);
    expect(rate.frameMs()).toBe(0);
  });

  it("averages frames over the window", () => {
    // Arrange: a steady 20 frames per second.
    const rate = new FrameRate(500);

    // Act
    for (let frame = 0; frame <= 20; frame++) {
      rate.tick(frame * 50);
    }

    // Assert
    expect(rate.fps()).toBeCloseTo(20);
    expect(rate.frameMs()).toBeCloseTo(50);
  });

  it("forgets frames older than the window, so a slowdown shows quickly", () => {
    // Arrange: fast at first, then slow.
    const rate = new FrameRate(500);
    for (let frame = 0; frame < 30; frame++) {
      rate.tick(frame * 16);
    }

    // Act
    for (let frame = 1; frame <= 6; frame++) {
      rate.tick(29 * 16 + frame * 200);
    }

    // Assert
    expect(rate.fps()).toBeCloseTo(5);
  });
});

describe("frameLabel", () => {
  it("rounds to whole numbers and puts the graphics chip on its own line", () => {
    // Act
    const withGpu = frameLabel(23.6, 41.2, 1480, 11.6, 4.4, "Intel(R) UHD Graphics 620");
    const without = frameLabel(23.6, 41.2, 1480, 11.6, 4.4, null);

    // Assert
    expect(withGpu).toBe("24 fps · 41 ms · cpu 12 ms (tim 4) · 1480 draw\nIntel(R) UHD Graphics 620");
    expect(without).toBe("24 fps · 41 ms · cpu 12 ms (tim 4) · 1480 draw");
  });
});

describe("gpuLabel", () => {
  it("unwraps the browser's ANGLE string to the chip's name", () => {
    // Act
    const intel = gpuLabel("ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)");
    const software = gpuLabel(
      "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)",
    );
    const plain = gpuLabel("Apple M2");

    // Assert
    expect(intel).toBe("Intel(R) UHD Graphics 620");
    expect(software).toBe("Vulkan 1.3.0 (SwiftShader Device (Subzero))");
    expect(plain).toBe("Apple M2");
  });
});

describe("paceFrame", () => {
  it("draws every frame with no cap", () => {
    // Act
    const frames = [0, 7, 14, 21].map((now) => paceFrame(now, 0, 0).draw);

    // Assert
    expect(frames).toEqual([true, true, true, true]);
  });

  it("averages the cap on a fast screen and skips the ticks in between", () => {
    // Arrange: a 144 Hz screen for two seconds, capped at 60.
    let dueAt = 0;
    let drawn = 0;

    // Act
    for (let tick = 0; tick < 288; tick++) {
      const pace = paceFrame((tick * 1000) / 144, dueAt, 60);
      dueAt = pace.dueAt;
      drawn += pace.draw ? 1 : 0;
    }

    // Assert
    expect(drawn).toBeGreaterThanOrEqual(110);
    expect(drawn).toBeLessThanOrEqual(122);
  });

  it("halves a 60 Hz screen at a cap of 30 and does not burst after a slow frame", () => {
    // Arrange
    let dueAt = 0;
    const drawnAt: number[] = [];
    const ticks = [0, 16.7, 33.3, 50, 66.7, 83.3, 400, 416.7, 433.3, 450];

    // Act
    for (const now of ticks) {
      const pace = paceFrame(now, dueAt, 30);
      dueAt = pace.dueAt;
      if (pace.draw) {
        drawnAt.push(now);
      }
    }

    // Assert
    expect(drawnAt).toEqual([0, 33.3, 66.7, 400, 433.3]);
  });
});
