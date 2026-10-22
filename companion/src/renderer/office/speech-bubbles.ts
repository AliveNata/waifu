import type { MemberId } from "../../shared/team.js";
import type { CloseupRect, SpeechAnchor } from "./office-stage.js";

/** Fades a new line in over this long, so bubbles do not pop. */
const fadeSeconds = 0.15;
/** Space between bubbles stacked over two people standing close. */
const stackGap = 4;

/** Small talk drawn as bubbles over the chibis' heads, positioned from the stage each frame. */
export class SpeechBubbles {
  private readonly bubbles = new Map<MemberId, HTMLParagraphElement>();

  constructor(private readonly layer: HTMLElement) {}

  /** `avoid` is the close-up viewport, where a bubble would cover the picture-in-picture. */
  render(anchors: readonly SpeechAnchor[], avoid: CloseupRect | null): void {
    const shown = new Set<MemberId>();
    for (const anchor of anchors) {
      if (avoid !== null && inside(anchor, avoid)) {
        continue;
      }
      shown.add(anchor.memberId);
      const bubble = this.bubbleFor(anchor.memberId);
      if (bubble.textContent !== anchor.text) {
        bubble.textContent = anchor.text;
      }
      bubble.hidden = false;
      bubble.style.transform = `translate(${Math.round(anchor.x)}px, ${Math.round(anchor.y)}px) translate(-50%, -100%)`;
      bubble.style.opacity = String(Math.min(1, anchor.shownFor / fadeSeconds));
    }
    for (const [memberId, bubble] of this.bubbles) {
      if (!shown.has(memberId)) {
        bubble.hidden = true;
      }
    }
    this.unstack(anchors.filter((anchor) => shown.has(anchor.memberId)));
  }

  /**
   * Two people side by side would get bubbles on top of each other. The lower one stays at its
   * head; any that would cover it moves up above it, so every line stays readable.
   */
  private unstack(anchors: readonly SpeechAnchor[]): void {
    const placed: { left: number; right: number; top: number; bottom: number }[] = [];
    const byHeight = [...anchors].sort((a, b) => b.y - a.y);
    for (const anchor of byHeight) {
      const bubble = this.bubbles.get(anchor.memberId);
      if (bubble === undefined) {
        continue;
      }
      const width = bubble.offsetWidth;
      const height = bubble.offsetHeight;
      const left = anchor.x - width / 2;
      const right = anchor.x + width / 2;
      let bottom = anchor.y;
      for (const other of placed) {
        const overlapsX = left < other.right && right > other.left;
        if (overlapsX && bottom > other.top && bottom - height < other.bottom) {
          bottom = other.top - stackGap;
        }
      }
      placed.push({ left, right, top: bottom - height, bottom });
      if (bottom !== anchor.y) {
        bubble.style.transform = `translate(${Math.round(anchor.x)}px, ${Math.round(bottom)}px) translate(-50%, -100%)`;
      }
    }
  }

  private bubbleFor(memberId: MemberId): HTMLParagraphElement {
    let bubble = this.bubbles.get(memberId);
    if (bubble === undefined) {
      bubble = document.createElement("p");
      bubble.className = "speech-bubble";
      bubble.dataset.member = memberId;
      this.layer.append(bubble);
      this.bubbles.set(memberId, bubble);
    }
    return bubble;
  }
}

function inside(point: { x: number; y: number }, rect: CloseupRect): boolean {
  return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
}
