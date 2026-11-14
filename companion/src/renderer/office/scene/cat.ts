import {
  ConeGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
} from "three";
import { type CatPose, playMoment } from "../office-cat.js";
import { ModelCat } from "./cat-model.js";
import { furnitureModel } from "./furniture-models.js";
import { box, mesh, standard } from "./palette.js";

/**
 * Mochi: the Somali cat model when it loaded (see cat-model.ts), otherwise an orange tabby built from rounded shapes at the office's scale, about 0.3 m nose to
 * rump. The parts hang off pivots (hips, shoulders, neck, the tail's joints) so poses are just
 * turns, the same way the team is posed. She faces +z.
 */
const fur = "#e8833a";
const furDark = "#c2611f";
const cream = "#f7e3c4";
const nose = "#e58b8b";
const eyeColor = "#2b2a1e";

const bodyLength = 0.24;
const bodyRadius = 0.065;
const legLength = 0.085;
const hipHeight = legLength + bodyRadius * 0.55;
const tailJoints = 6;
const tailSegment = 0.035;

export interface CatFrame {
  pose: CatPose;
  /** Radians along the walk cycle. */
  walkPhase: number;
  /** Seconds, for breathing, the tail and looking about. */
  time: number;
  /** 0..1 while someone strokes her: eyes shut, head pushed up into the hand. */
  petted: number;
  /** Radians to turn the head toward someone, within reason. */
  look: number;
}

function sphere(radius: number, color: string, segments = 16): Mesh {
  return mesh(new SphereGeometry(radius, segments, Math.round(segments * 0.75)), standard(color, 0.85));
}

export class OfficeCat {
  readonly root = new Group();
  private readonly body = new Group();
  private readonly neck = new Group();
  private readonly legs: { pivot: Group; front: boolean; side: number }[] = [];
  private readonly tail: Group[] = [];
  private readonly eyes: Mesh[] = [];
  private readonly model = ModelCat.create();
  /** Her ball of yarn, out only while she plays with it. */
  private readonly ball = yarnBall();

  constructor() {
    this.ball.visible = false;
    this.root.add(this.ball);
    if (this.model !== null) {
      this.root.add(this.model.root);
      return;
    }
    const torso = sphere(bodyRadius, fur);
    torso.scale.set(1, 0.95, bodyLength / (2 * bodyRadius));
    const belly = sphere(bodyRadius * 0.9, cream);
    belly.scale.set(0.8, 0.7, (bodyLength * 0.8) / (2 * bodyRadius));
    belly.position.y = -bodyRadius * 0.3;
    this.body.add(torso, belly);
    // Tabby stripes across the back.
    for (let index = 0; index < 4; index++) {
      const stripe = box(0.09, 0.006, 0.014, standard(furDark, 0.85), 0, bodyRadius * 0.88, -0.07 + index * 0.045);
      stripe.rotation.x = -0.05 + index * 0.03;
      this.body.add(stripe);
    }

    // The head on its neck at the front of the body.
    this.neck.position.set(0, bodyRadius * 0.55, bodyLength / 2 - 0.01);
    const head = sphere(0.058, fur);
    head.scale.set(1.1, 0.95, 1);
    head.position.set(0, 0.05, 0.03);
    const muzzle = sphere(0.026, cream, 12);
    muzzle.scale.set(1.3, 0.8, 1);
    muzzle.position.set(0, 0.028, 0.078);
    const tip = sphere(0.007, nose, 8);
    tip.position.set(0, 0.04, 0.094);
    this.neck.add(head, muzzle, tip);
    for (const side of [-1, 1]) {
      const ear = mesh(new ConeGeometry(0.022, 0.04, 4), standard(fur, 0.85));
      ear.position.set(side * 0.035, 0.105, 0.02);
      ear.rotation.set(-0.15, Math.PI / 4, side * -0.25);
      const inner = mesh(new ConeGeometry(0.012, 0.025, 4), standard(nose, 0.9), false);
      inner.position.set(side * 0.034, 0.1, 0.03);
      inner.rotation.copy(ear.rotation);
      const eye = sphere(0.0095, eyeColor, 10);
      eye.position.set(side * 0.025, 0.06, 0.078);
      this.eyes.push(eye);
      this.neck.add(ear, inner, eye);
      // Forehead stripes, the M of a tabby.
      this.neck.add(box(0.006, 0.02, 0.006, standard(furDark, 0.85), side * 0.012, 0.085, 0.07));
    }
    this.body.add(this.neck);

    // Legs pivot at the shoulder and hip, paws cream.
    for (const front of [true, false]) {
      for (const side of [-1, 1]) {
        const pivot = new Group();
        pivot.position.set(side * bodyRadius * 0.55, -bodyRadius * 0.35, (front ? 1 : -1) * bodyLength * 0.32);
        const leg = mesh(new CylinderGeometry(0.014, 0.012, legLength, 8), standard(fur, 0.85));
        leg.position.y = -legLength / 2;
        const paw = sphere(0.016, cream, 8);
        paw.scale.set(1, 0.6, 1.3);
        paw.position.set(0, -legLength, 0.006);
        pivot.add(leg, paw);
        this.body.add(pivot);
        this.legs.push({ pivot, front, side });
      }
    }

    // The tail: a chain of joints from the rump, each turning a little to curve it.
    let parent: Group = this.body;
    for (let index = 0; index < tailJoints; index++) {
      const joint = new Group();
      joint.position.set(0, 0, index === 0 ? -bodyLength / 2 + 0.01 : -tailSegment);
      const radius = 0.016 - index * 0.0013;
      const piece = mesh(
        new CylinderGeometry(radius, radius, tailSegment + 0.004, 8),
        standard(index % 2 === 0 ? fur : furDark, 0.85),
      );
      piece.rotation.x = Math.PI / 2;
      piece.position.z = -tailSegment / 2;
      joint.add(piece);
      parent.add(joint);
      this.tail.push(joint);
      parent = joint;
    }

    this.body.position.y = hipHeight;
    this.root.add(this.body);
  }

  update(frame: CatFrame): void {
    this.ball.visible = frame.pose === "play";
    if (this.ball.visible) {
      const moment = playMoment(frame.time);
      this.ball.position.z = moment.ballAhead;
      this.ball.rotation.x = moment.ballTurn;
    }
    if (this.model !== null) {
      this.model.update(frame);
      return;
    }
    const { pose, time, petted } = frame;
    const breath = 1 + 0.025 * Math.sin(time * (pose === "sleep" ? 1.6 : 3));
    this.body.scale.set(breath, breath, 1);
    let bodyY = hipHeight;
    let bodyPitch = 0;
    let neckPitch = 0;
    let neckYaw = Math.max(-0.9, Math.min(0.9, frame.look));
    let legsDown = 1;
    let eyesOpen = 1;
    // Tail: lift at the base (up is positive), how much each joint curls up, a sideways sway,
    // and how far it wraps round to the side when she sits or curls up.
    let tailLift = 0.2;
    let tailCurl = 0.15;
    let tailSway = 0.25 * Math.sin(time * 1.3);
    let tailWrap = 0;
    const swing = Math.sin(frame.walkPhase);

    switch (pose) {
      case "walk":
        tailLift = 0.9;
        tailCurl = -0.08;
        neckPitch = 0.05 * Math.sin(frame.walkPhase * 2);
        bodyY = hipHeight + 0.004 * Math.abs(swing);
        break;
      case "stretch":
        // Chest down and front legs out, rump still up.
        bodyPitch = 0.35;
        neckPitch = -0.4;
        tailLift = 0.7;
        break;
      case "sit":
      case "play":
      case "beg":
      case "stare":
      case "groom":
      case "eat":
        // Haunches down, front legs straight: the body tips up at the front.
        bodyPitch = -0.55;
        bodyY = hipHeight - 0.02;
        tailLift = -0.5;
        tailCurl = 0.05;
        tailWrap = 0.3;
        tailSway = 0.1 * Math.sin(time * 0.8);
        if (pose === "beg") {
          neckPitch = -0.45;
        } else if (pose === "stare") {
          // Following a fish back and forth, the tip of the tail twitching.
          neckYaw = 0.35 * Math.sin(time * 0.9);
          neckPitch = -0.05;
          tailSway = 0.12 * Math.sin(time * 6);
        } else if (pose === "eat") {
          // Head down in the bowl, chewing.
          neckPitch = 0.75 + 0.08 * Math.sin(time * 9);
          tailSway = 0.18 * Math.sin(time * 1.6);
        } else if (pose === "groom") {
          // Head down to the side, licking.
          neckYaw = 0.6;
          neckPitch = 0.55 + 0.12 * Math.max(0, Math.sin(time * 7));
        }
        break;
      case "loaf":
      case "sleep":
        // Legs tucked under, body low; asleep, the head rests on the paws.
        legsDown = 0.15;
        bodyY = bodyRadius * 0.85;
        tailLift = -0.15;
        tailCurl = 0;
        tailWrap = 0.45;
        tailSway = 0.05 * Math.sin(time * 0.5);
        if (pose === "sleep") {
          neckPitch = 0.55;
          neckYaw = 0.4;
          eyesOpen = 0;
        } else {
          eyesOpen = 0.45 + 0.55 * (Math.sin(time * 0.3) > 0.7 ? 1 : 0);
        }
        break;
    }
    if (petted > 0) {
      // Pushing up into the hand, eyes shut.
      neckPitch -= 0.35 * petted;
      eyesOpen *= 1 - petted;
    }

    this.body.position.y = bodyY;
    this.body.rotation.x = bodyPitch;
    this.neck.rotation.set(neckPitch, neckYaw, 0);
    for (const eye of this.eyes) {
      eye.scale.y = Math.max(0.12, eyesOpen);
    }
    for (const { pivot, front, side } of this.legs) {
      pivot.scale.y = legsDown;
      if (pose === "walk") {
        // Diagonal pairs move together, as cats walk.
        const phase = (front ? 1 : -1) * side;
        pivot.rotation.x = 0.45 * swing * phase;
      } else if (
        !front &&
        (pose === "sit" || pose === "beg" || pose === "stare" || pose === "groom" || pose === "eat")
      ) {
        // Hind legs folded under the haunches.
        pivot.rotation.x = 1.2;
        pivot.scale.y = 0.6;
      } else if (front && pose === "groom" && side === 1) {
        // One paw up to the mouth.
        pivot.rotation.x = -0.8 - 0.15 * Math.sin(time * 7);
      } else {
        // Front legs stay plumb while the body is tipped up.
        pivot.rotation.x = front ? -bodyPitch : 0;
      }
    }
    this.tail.forEach((joint, index) => {
      joint.rotation.x = index === 0 ? tailLift : tailCurl;
      joint.rotation.y = tailWrap + tailSway * (0.4 + index * 0.25);
    });
  }
}

const ballRadius = 0.022;

/** A ball of yarn, wound round a few ways, resting on the floor at the origin. */
function yarnBall(): Group {
  const ball = new Group();
  const yarn = standard("#d9566b", 0.95);
  const core = mesh(new IcosahedronGeometry(ballRadius, 2), yarn, false);
  ball.add(core);
  for (const [x, y] of [
    [0, 0],
    [Math.PI / 2, 0],
    [Math.PI / 3, Math.PI / 4],
  ] as const) {
    const wind = mesh(new TorusGeometry(ballRadius, 0.003, 4, 20), standard("#b8414f", 0.95), false);
    wind.rotation.set(x, y, 0);
    ball.add(wind);
  }
  ball.position.y = ballRadius;
  return ball;
}

/** Her bowl's purple, so it is plainly hers. */
const bowlColor = "#b45cff";

/**
 * Mochi's food bowl with kibble in it, more or less full: the "Dog Bowl" model by Zambur
 * (Sketchfab, CC-BY-4.0, credited in docs/03-companion.md) at a cat's size and tinted her purple,
 * or a plain dish when it did not load.
 */
export class CatBowl {
  readonly root = new Group();
  private readonly food: Mesh;

  constructor() {
    const model = furnitureModel("catBowl");
    if (model === null) {
      const dish = mesh(new CylinderGeometry(0.065, 0.05, 0.03, 20), standard(bowlColor, 0.5));
      dish.position.y = 0.015;
      this.root.add(dish);
    } else {
      model.traverse((part) => {
        if (part instanceof Mesh && part.material instanceof MeshStandardMaterial) {
          part.material = part.material.clone();
          part.material.color.set(bowlColor);
        }
      });
      this.root.add(model);
    }
    // The model's well is narrower than its rim, so the kibble sits inside it.
    const radius = model === null ? 0.052 : 0.045;
    this.food = mesh(new CylinderGeometry(radius, radius, 0.014, 18), standard("#9a5b2e", 0.9), false);
    this.root.add(this.food);
    this.setFood(1);
  }

  /** 0 empty to 1 full. */
  setFood(level: number): void {
    const clamped = Math.max(0, Math.min(1, level));
    this.food.visible = clamped > 0.01;
    this.food.scale.y = Math.max(0.05, clamped);
    this.food.position.y = 0.012 + 0.007 * clamped;
  }
}
