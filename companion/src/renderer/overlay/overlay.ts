import "../common/base.css";
import "./overlay.css";
import { getBridge } from "../common/bridge.js";
import { CompanionPage } from "../common/page.js";
import { OverlayStage } from "./overlay-stage.js";

const bridge = getBridge();
document.documentElement.dataset.shell = bridge.hasNativeMenu ? "electron" : "web";

const canvas = document.getElementById("scene");
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("#scene canvas is missing");
}

let page: CompanionPage | null = null;
const stage = new OverlayStage(canvas, () => page?.tick());
page = new CompanionPage(bridge, stage);
bridge.onCursor((offset) => stage.setCursor(offset));
page.start();
