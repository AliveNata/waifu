import type { VRM } from "@pixiv/three-vrm";
import {
  DirectionalLight,
  HemisphereLight,
  OrthographicCamera,
  PCFShadowMap,
  Scene,
  Timer,
  Vector3,
  WebGLRenderer,
} from "three";
import { idleReaction, type Reaction } from "../../shared/reaction.js";
import {
  BlinkScheduler,
  type ExpressionWeights,
  expressionTargetsForMood,
  stepExpressionWeights,
} from "../common/expressions.js";
import type { Stage } from "../common/page.js";
import { PoseApplier } from "../common/pose.js";
import { applyChibi, type ChibiMetrics } from "./chibi.js";
import { type ActorState, actorActivity, initialActor, stepActor } from "./office-actor.js";
import { stationForMood } from "./office-layout.js";
import { officePose } from "./office-pose.js";
import { buildOffice, setScreenOn } from "./office-scene.js";

const cameraDirection = new Vector3(1, 0.82, 1).normalize();
const cameraFocus = new Vector3(0, 0.55, -0.15);
/** World units that must stay visible: roughly the room's diagonal footprint. */
const minimumViewWidth = 8.4;
const minimumViewHeight = 5.2;

export class OfficeStage implements Stage {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  private readonly timer = new Timer();
  private readonly poseApplier = new PoseApplier(10);
  private readonly blink = new BlinkScheduler();
  private readonly office = buildOffice();

  private vrm: VRM | null = null;
  private metrics: ChibiMetrics | null = null;
  private baseYaw = 0;
  private actor: ActorState = initialActor("sofa");
  private reaction: Reaction = idleReaction(Date.now());
  private moodStartedAt = 0;
  private expressionWeights: ExpressionWeights = {};
  private elapsed = 0;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly onFrame: () => void,
  ) {
    this.renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // Shadows ground the chibi on the floor; without them she reads as floating.
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;

    const sun = new DirectionalLight(0xffffff, 2.2);
    sun.position.set(3, 7, 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -5;
    sun.shadow.camera.right = 5;
    sun.shadow.camera.top = 5;
    sun.shadow.camera.bottom = -5;
    sun.shadow.bias = -0.0005;
    this.scene.add(new HemisphereLight(0xfff8ee, 0x8a7a66, 1.6), sun, this.office.root);

    this.camera.position.copy(cameraFocus).addScaledVector(cameraDirection, 20);
    this.camera.lookAt(cameraFocus);

    window.addEventListener("resize", () => this.resize());
    this.resize();
    this.renderer.setAnimationLoop((timestamp) => this.frame(timestamp));
  }

  setModel(vrm: VRM | null): void {
    if (this.vrm !== null) {
      this.scene.remove(this.vrm.scene);
    }
    this.vrm = vrm;
    this.metrics = null;
    this.poseApplier.reset();
    this.expressionWeights = {};
    if (vrm === null) {
      return;
    }
    this.baseYaw = vrm.scene.rotation.y;
    this.metrics = applyChibi(vrm);
    vrm.scene.traverse((object) => {
      object.castShadow = true;
    });
    this.actor = initialActor(stationForMood(this.reaction.mood));
    this.scene.add(vrm.scene);
  }

  setReaction(reaction: Reaction): void {
    if (reaction.mood !== this.reaction.mood || reaction.receivedAt !== this.reaction.receivedAt) {
      this.moodStartedAt = this.elapsed;
    }
    this.reaction = reaction;
  }

  private resize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = width / height;
    const viewHeight = Math.max(minimumViewHeight, minimumViewWidth / aspect);
    const viewWidth = viewHeight * aspect;
    this.camera.left = -viewWidth / 2;
    this.camera.right = viewWidth / 2;
    this.camera.top = viewHeight / 2;
    this.camera.bottom = -viewHeight / 2;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private frame(timestamp: number): void {
    this.timer.update(timestamp);
    const delta = Math.min(this.timer.getDelta(), 0.1);
    this.elapsed += delta;
    this.onFrame();

    const mood = this.reaction.mood;
    const vrm = this.vrm;
    const metrics = this.metrics;
    if (vrm !== null && metrics !== null) {
      this.actor = stepActor(this.actor, stationForMood(mood), delta);
      const activity = actorActivity(this.actor);

      vrm.scene.position.set(this.actor.position.x, metrics.floorOffset, this.actor.position.z);
      vrm.scene.rotation.y = this.baseYaw + this.actor.yaw;

      const pose = officePose({
        activity,
        mood,
        time: this.elapsed,
        moodElapsed: this.elapsed - this.moodStartedAt,
        sitDrop: metrics.sitDrop,
      });
      this.poseApplier.apply(vrm, pose, delta);

      this.expressionWeights = stepExpressionWeights(this.expressionWeights, expressionTargetsForMood(mood), delta);
      const expressions = vrm.expressionManager;
      if (expressions != null) {
        for (const [name, weight] of Object.entries(this.expressionWeights)) {
          expressions.setValue(name, weight);
        }
        const happy = this.expressionWeights.happy ?? 0;
        expressions.setValue("blink", this.blink.weightAt(this.elapsed) * (1 - happy));
      }
      vrm.update(delta);

      setScreenOn(this.office.screen, activity.kind === "station" && activity.activity === "sit-type");
    }

    this.renderer.render(this.scene, this.camera);
  }
}
