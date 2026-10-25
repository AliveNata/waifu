import "../common/base.css";
import "./overlay.css";
import { isCompanionFace, isCompanionPose } from "../../shared/companion-pose.js";
import { getBridge } from "../common/bridge.js";
import { CompanionPage } from "../common/page.js";
import { requireElement } from "../common/status-chip.js";
import { OverlayStage } from "./overlay-stage.js";
import { PointerGestures } from "./pointer-gestures.js";
import type { TouchReaction } from "./touch-reactions.js";

const bridge = getBridge();
document.documentElement.dataset.shell = bridge.hasNativeMenu ? "electron" : "web";

const canvas = document.getElementById("scene");
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("#scene canvas is missing");
}
const root = requireElement("stage", HTMLElement);
const line = requireElement("touch-line", HTMLElement);

let page: CompanionPage | null = null;
const stage = new OverlayStage(canvas, () => page?.tick());
page = new CompanionPage(bridge, stage);
bridge.onCursor((offset) => stage.setCursor(offset));
page.start();

let hideLineTimer: number | undefined;
function showLine(text: string, milliseconds: number): void {
  line.textContent = text;
  line.hidden = false;
  window.clearTimeout(hideLineTimer);
  hideLineTimer = window.setTimeout(() => {
    line.hidden = true;
  }, milliseconds);
}

function say(reaction: TouchReaction | null): void {
  if (reaction !== null && reaction.line !== null) {
    showLine(reaction.line, Math.max(1600, reaction.durationSeconds * 1000));
  }
}

// Sesi 2B in the office: her replies and asked-for poses show here, on the desktop.
bridge.onCompanionCommand((command) => {
  if (command.pose !== null || command.face !== null) {
    stage.setCommand(command.pose, command.face);
  }
  if (command.line !== null) {
    // Long enough to read at a relaxed pace.
    showLine(command.line, Math.max(2500, command.line.length * 70));
  }
});

// Hovering: the 3D hand shows over her body and the system pointer hides there. One hit test
// per frame at most, however fast the mouse.
let hoverAt: { x: number; y: number } | null = null;
root.addEventListener("pointermove", (event) => {
  if (event.pointerType !== "mouse") {
    return;
  }
  const pending = hoverAt === null;
  hoverAt = { x: event.clientX, y: event.clientY };
  if (pending) {
    requestAnimationFrame(() => {
      if (hoverAt !== null) {
        const over = stage.hover(hoverAt.x, hoverAt.y) !== null || stage.handBusy();
        root.classList.toggle("hand-pointer", over && stage.handReady);
      }
      hoverAt = null;
    });
  }
});
root.addEventListener("pointerleave", () => {
  stage.hideHand();
  root.classList.remove("hand-pointer");
});

new PointerGestures(root, {
  zoneAt: (x, y) => stage.zoneAt(x, y)?.zone ?? null,
  touch: (x, y, kind) => say(stage.touchAt(x, y, kind)),
  beginDrag: () => bridge.beginWindowDrag(),
  drag: (dx, dy) => bridge.dragWindow(dx, dy),
}).start();

// Without a drag region, a right-click reaches the page instead of the system, so open 2B's menu here.
root.addEventListener("contextmenu", (event) => {
  if (bridge.hasNativeMenu) {
    event.preventDefault();
    bridge.openMenu();
  }
});

// Browser preview only: /overlay/?pose=peace or ?face=smile shows a pose without the office chat.
if (!bridge.hasNativeMenu) {
  const params = new URLSearchParams(window.location.search);
  const pose = params.get("pose");
  const face = params.get("face");
  if (isCompanionPose(pose) || isCompanionFace(face)) {
    stage.setCommand(isCompanionPose(pose) ? pose : null, isCompanionFace(face) ? face : null);
  }
}
