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
function say(reaction: TouchReaction | null): void {
  if (reaction === null || reaction.line === null) {
    return;
  }
  line.textContent = reaction.line;
  line.hidden = false;
  window.clearTimeout(hideLineTimer);
  hideLineTimer = window.setTimeout(
    () => {
      line.hidden = true;
    },
    Math.max(1600, reaction.durationSeconds * 1000),
  );
}

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
