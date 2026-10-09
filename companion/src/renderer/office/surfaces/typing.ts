export interface ScreenDocument {
  title: string;
  text: string;
}

export interface VisibleText {
  lines: string[];
  /** Line number (1-based) of the first visible line, for the gutter. */
  firstLineNumber: number;
  cursorLine: number;
  cursorColumn: number;
}

/**
 * The part of `text` that has been typed so far, scrolled so the cursor stays
 * on screen once the document is longer than `maxLines`.
 */
export function visibleText(text: string, typed: number, maxLines: number): VisibleText {
  const typedLines = text.slice(0, typed).split("\n");
  const cursorLineIndex = typedLines.length - 1;
  const firstIndex = Math.max(0, cursorLineIndex - maxLines + 1);
  return {
    lines: typedLines.slice(firstIndex),
    firstLineNumber: firstIndex + 1,
    cursorLine: cursorLineIndex - firstIndex,
    cursorColumn: typedLines[cursorLineIndex]?.length ?? 0,
  };
}

export interface TypingStep {
  /** Characters typed during this step, in order. Drives the keyboard animation. */
  typed: string;
  /** True when what is on screen changed and needs a redraw. */
  changed: boolean;
}

const charsPerSecond = 22;
const endOfLinePauseSeconds = 0.3;
const finishedHoldSeconds = 2.5;

/** Simulated typing through a list of documents, looping forever. `random` is injectable for tests. */
export class TypingProgress {
  private documentIndex = 0;
  private typedCount = 0;
  private budget = 0;
  private pause = 0;

  constructor(
    private readonly documents: readonly ScreenDocument[],
    private readonly random: () => number = Math.random,
  ) {
    if (documents.length === 0) {
      throw new Error("TypingProgress needs at least one document");
    }
  }

  get document(): ScreenDocument {
    return this.documents[this.documentIndex] as ScreenDocument;
  }

  get typed(): number {
    return this.typedCount;
  }

  step(deltaSeconds: number, typing: boolean): TypingStep {
    if (!typing) {
      return { typed: "", changed: false };
    }
    if (this.pause > 0) {
      this.pause -= deltaSeconds;
      return { typed: "", changed: false };
    }
    const text = this.document.text;
    if (this.typedCount >= text.length) {
      // Finished document: hold it on screen, then start the next one.
      this.documentIndex = (this.documentIndex + 1) % this.documents.length;
      this.typedCount = 0;
      this.budget = 0;
      return { typed: "", changed: true };
    }

    // Uneven speed reads as a person typing rather than a progress bar.
    this.budget += deltaSeconds * charsPerSecond * (0.6 + this.random() * 0.8);
    let typed = "";
    while (this.budget >= 1 && this.typedCount < text.length) {
      const character = text[this.typedCount] as string;
      this.typedCount += 1;
      this.budget -= 1;
      typed += character;
      if (character === "\n") {
        this.pause = endOfLinePauseSeconds;
        break;
      }
    }
    if (this.typedCount >= text.length) {
      this.pause = finishedHoldSeconds;
    }
    return { typed, changed: typed.length > 0 };
  }
}
