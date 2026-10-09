import "../common/base.css";
import "./office.css";
import { getBridge } from "../common/bridge.js";
import { CompanionPage } from "../common/page.js";
import { OfficeStage } from "./office-stage.js";

const bridge = getBridge();
document.documentElement.dataset.shell = bridge.hasNativeMenu ? "electron" : "web";

const canvas = document.getElementById("scene");
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("#scene canvas is missing");
}

let page: CompanionPage | null = null;
const stage = new OfficeStage(canvas, () => page?.tick());
page = new CompanionPage(bridge, stage);
page.start();
