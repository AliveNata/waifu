import { type MemberId, roster } from "../../shared/team.js";

/** What the office page needs from the 3D stage to answer the pointer. */
export interface PointerStage {
  memberAt(clientX: number, clientY: number): MemberId | null;
  statusBoardAt(clientX: number, clientY: number): boolean;
  pinCloseup(memberId: MemberId | null): void;
  pinnedMember(): MemberId | null;
}

/** A press that moves less than this, in CSS pixels, is a click; more is a drag to turn the view. */
const clickSlop = 5;

/**
 * Hover and click on the 3D office: hovering a teammate shows their name and role by the
 * pointer, clicking one keeps their close-up up as a preview, clicking anywhere else closes it,
 * and clicking the status board on the wall opens it large.
 */
export class OfficePointer {
  private last: { x: number; y: number } | null = null;
  private pressed: { x: number; y: number } | null = null;
  private tipFor: MemberId | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly stage: PointerStage,
    private readonly tip: HTMLElement,
    private readonly openStatus: () => void,
    private readonly dialogOpen: () => boolean,
  ) {}

  start(): void {
    this.canvas.addEventListener("pointermove", (event) => {
      this.last = { x: event.clientX, y: event.clientY };
      this.refresh();
    });
    this.canvas.addEventListener("pointerleave", () => {
      this.last = null;
      this.refresh();
    });
    this.canvas.addEventListener("pointerdown", (event) => {
      this.pressed = { x: event.clientX, y: event.clientY };
      // Turning the view: the tip would only get in the way.
      this.showTip(null);
    });
    this.canvas.addEventListener("pointerup", (event) => {
      const start = this.pressed;
      this.pressed = null;
      if (start === null || Math.hypot(event.clientX - start.x, event.clientY - start.y) > clickSlop) {
        return;
      }
      this.click(event.clientX, event.clientY);
    });
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !this.dialogOpen() && this.stage.pinnedMember() !== null) {
        this.stage.pinCloseup(null);
      }
    });
  }

  /** Called every tick too: people walk in and out from under a still pointer. */
  refresh(): void {
    if (this.last === null || this.pressed !== null) {
      this.showTip(null);
      this.canvas.style.cursor = "";
      return;
    }
    const member = this.stage.memberAt(this.last.x, this.last.y);
    const board = member === null && this.stage.statusBoardAt(this.last.x, this.last.y);
    this.canvas.style.cursor = member !== null || board ? "pointer" : "";
    this.showTip(member);
  }

  private click(x: number, y: number): void {
    const member = this.stage.memberAt(x, y);
    if (member !== null) {
      this.stage.pinCloseup(member);
      return;
    }
    // Anywhere else closes the preview; the status board also opens large.
    this.stage.pinCloseup(null);
    if (this.stage.statusBoardAt(x, y)) {
      this.openStatus();
    }
  }

  private showTip(member: MemberId | null): void {
    if (member === null) {
      if (!this.tip.hidden) {
        this.tip.hidden = true;
      }
      this.tipFor = null;
      return;
    }
    if (member !== this.tipFor) {
      this.tipFor = member;
      const profile = roster[member];
      const name = document.createElement("strong");
      name.textContent = profile.displayName;
      this.tip.replaceChildren(name, ` · ${profile.role}`);
    }
    if (this.last !== null) {
      this.tip.style.left = `${this.last.x + 14}px`;
      this.tip.style.top = `${this.last.y + 16}px`;
    }
    this.tip.hidden = false;
  }
}
