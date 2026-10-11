import { describe, expect, it } from "vitest";
import { arrow, charInk, diagramInk, inkProgress, line, rect, text } from "../src/renderer/office/surfaces/drawing.js";
import { TypingProgress, visibleText } from "../src/renderer/office/surfaces/typing.js";

describe("visibleText", () => {
  it("shows what has been typed with the cursor at the end", () => {
    // Act
    const view = visibleText("select 1\nfrom t", 10, 10);

    // Assert
    expect(view.lines).toEqual(["select 1", "f"]);
    expect(view.cursorLine).toBe(1);
    expect(view.cursorColumn).toBe(1);
  });

  it("scrolls so the cursor line stays visible", () => {
    // Act
    const view = visibleText("a\nb\nc\nd", 7, 2);

    // Assert
    expect(view.lines).toEqual(["c", "d"]);
    expect(view.firstLineNumber).toBe(3);
  });
});

describe("TypingProgress", () => {
  it("types nothing while the member is not working", () => {
    // Arrange
    const progress = new TypingProgress([{ title: "t", text: "hello" }], () => 0.5);

    // Act
    const step = progress.step(1, false);

    // Assert
    expect(step).toEqual({ typed: "", changed: false });
  });

  it("pauses at the end of a line, then moves to the next document after finishing", () => {
    // Arrange
    const progress = new TypingProgress(
      [
        { title: "one", text: "ab\ncd" },
        { title: "two", text: "x" },
      ],
      () => 0.5,
    );

    // Act
    const first = progress.step(1, true);
    progress.step(0.31, true);
    progress.step(1, true);
    progress.step(3, true);
    progress.step(0.1, true);

    // Assert
    expect(first.typed).toBe("ab\n");
    expect(progress.document.title).toBe("two");
  });
});

describe("board drawing", () => {
  it("measures ink for lines and text", () => {
    // Arrange
    const diagram = [line([0, 0], [0.5, 0]), text([0, 0.5], "abcd")];

    // Act
    const ink = diagramInk(diagram);

    // Assert
    expect(ink).toBeCloseTo(0.5 + 4 * charInk);
  });

  it("puts the pen along the stroke being drawn", () => {
    // Arrange
    const diagram = [rect(0, 0, 0.2, 0.1), arrow([0.3, 0.5], [0.6, 0.5])];

    // Act
    const progress = inkProgress(diagram, 0.6 + 0.15);

    // Assert
    expect(progress.strokes).toHaveLength(2);
    expect(progress.strokes[0]?.fraction).toBe(1);
    expect(progress.pen?.[0]).toBeCloseTo(0.45);
    expect(progress.pen?.[1]).toBeCloseTo(0.5);
  });
});
