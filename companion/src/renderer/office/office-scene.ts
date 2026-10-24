import { VRMSpringBoneCollider, VRMSpringBoneColliderShapePlane } from "@pixiv/three-vrm";
import {
  Group,
  Mesh,
  type MeshBasicMaterial,
  PlaneGeometry,
  SphereGeometry,
  SRGBColorSpace,
  type Texture,
  TextureLoader,
  Vector3,
} from "three";
import type { MemberId } from "../../shared/team.js";
import logoUrl from "./assets/alyxlabs-logo.png";
import { chairSeatHeight, type Furniture, furniture, meetingStationIds, room, stations } from "./office-plan.js";
import type { ArcadeScreen, LaptopScreen, RackLights, TvScreen } from "./scene/animated.js";
import { buildContactShadows } from "./scene/contact-shadows.js";
import { buildDesk, type DeskMember, deskTop, type Workstation } from "./scene/desks.js";
import {
  buildArcade,
  buildBackdrop,
  buildBarCounter,
  buildBeanbag,
  buildCameraTripod,
  buildChair,
  buildCoffeeTable,
  buildFridge,
  buildKanban,
  buildMeetingTable,
  buildPantryCounter,
  buildPingpongTable,
  buildPlant,
  buildPrinterCabinet,
  buildRingLight,
  buildRug,
  buildServerRack,
  buildSofa,
  buildStool,
  buildTvConsole,
  buildTvWall,
  type FridgeDoor,
  type Oven,
  type SinkTap,
} from "./scene/furniture.js";
import { NeonStrips } from "./scene/neon.js";
import { box, glow, mesh, palette, printed, sceneQuality, standard, unlit } from "./scene/palette.js";
import { surfaceMaps } from "./scene/surface-detail.js";
import { floorTexture, kanbanTexture, signTextTexture, windowTexture } from "./scene/textures.js";
import { IdeaBoard } from "./surfaces/idea-board.js";
import { riasDiagrams, twobDiagrams, Whiteboard } from "./surfaces/whiteboard.js";

export type { DeskMember, Workstation } from "./scene/desks.js";
export { deskTop } from "./scene/desks.js";

export interface CloseupShot {
  eye: Vector3;
  target: Vector3;
}

export interface OfficeProps {
  root: Group;
  workstations: Record<DeskMember, Workstation>;
  whiteboard: Whiteboard;
  ideaBoard: IdeaBoard;
  /** Board UV (0..1, v down) to the world point just in front of the board surface. */
  whiteboardPoint(u: number, v: number): Vector3;
  ideaBoardPoint(u: number, v: number): Vector3;
  closeups: Record<MemberId, CloseupShot>;
  /** Floor and backrest colliders every avatar's hair should respect. */
  hairColliders: VRMSpringBoneCollider[];
  tv: TvScreen;
  arcade: ArcadeScreen;
  rackLights: RackLights;
  neon: NeonStrips;
  /** Hidden unless two players are at the table. */
  pingpongBall: Mesh;
  /** One per meeting chair, in seat order meeting-1..6. */
  meetingLaptops: LaptopScreen[];
  fridgeDoor: FridgeDoor;
  sink: SinkTap;
  oven: Oven;
  /** Cross-fades the window view between day (0) and night (1). */
  setNight(night: number): void;
}

interface BoardSpec {
  centerZ: number;
  width: number;
  bottom: number;
  height: number;
}

const wallSurfaceX = room.minX + 0.07;

function pieceById(id: string): Furniture {
  const piece = furniture.find((candidate) => candidate.id === id);
  if (piece === undefined) {
    throw new Error(`Floor plan has no piece "${id}"`);
  }
  return piece;
}

function leftWallPoint(spec: BoardSpec, u: number, v: number): Vector3 {
  // Facing the left wall, board "left" is +Z, so u grows toward -Z.
  const z = spec.centerZ + spec.width / 2 - u * spec.width;
  const y = spec.bottom + spec.height * (1 - v);
  return new Vector3(wallSurfaceX + 0.02, y, z);
}

function leftWallPlane(map: Texture, spec: BoardSpec, frameColor: string): Group {
  const group = new Group();
  group.add(
    box(
      0.04,
      spec.height + 0.08,
      spec.width + 0.08,
      standard(frameColor, 0.6),
      room.minX + 0.03,
      spec.bottom - 0.04,
      spec.centerZ,
    ),
  );
  const plane = mesh(new PlaneGeometry(spec.width, spec.height), printed(map), false);
  plane.rotation.y = Math.PI / 2;
  plane.position.set(wallSurfaceX, spec.bottom + spec.height / 2, spec.centerZ);
  group.add(plane);
  return group;
}

function buildRoomShell(root: Group, logo: Texture): { nightGlass: MeshBasicMaterial[] } {
  const width = room.maxX - room.minX;
  const depth = room.maxZ - room.minZ;
  const centerX = (room.minX + room.maxX) / 2;
  const centerZ = (room.minZ + room.maxZ) / 2;

  const floorMap = floorTexture();
  floorMap.repeat.set(width / 1.45, depth / 1.45);
  const floorMaterial = standard(palette.floor, 0.85);
  floorMaterial.map = floorMap;
  if (sceneQuality() === "high") {
    // Wood grain per plank, on the same tiling as the planks themselves.
    const grain = surfaceMaps("planks").normalMap.clone();
    grain.repeat.copy(floorMap.repeat);
    floorMaterial.normalMap = grain;
  }
  const floor = new Mesh(new PlaneGeometry(width, depth), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(centerX, 0, centerZ);
  floor.receiveShadow = true;
  root.add(floor);

  const wallThickness = 0.12;
  root.add(
    box(
      width,
      room.wallHeight,
      wallThickness,
      standard(palette.backWall, 0.95),
      centerX,
      0,
      room.minZ - wallThickness / 2,
    ),
    box(
      wallThickness,
      room.wallHeight,
      depth,
      standard(palette.sideWall, 0.95),
      room.minX - wallThickness / 2,
      0,
      centerZ,
    ),
    box(width, 0.1, 0.03, standard(palette.skirting, 0.7), centerX, 0, room.minZ + 0.015),
    box(0.03, 0.1, depth, standard(palette.skirting, 0.7), room.minX + 0.015, 0, centerZ),
  );

  // Two windows over the desks with the sign between them, so the brand sits at the room's focal point.
  // The sills clear the monitors and the tops stay under a chibi-scaled 2.2 m wall.
  const sill = 1.0;
  const windowHeight = 0.85;
  const nightGlass: MeshBasicMaterial[] = [];
  for (const [index, [left, right]] of (
    [
      [-3.6, -1.05],
      [1.75, 4.3],
    ] as const
  ).entries()) {
    const windowWidth = right - left;
    const x = (left + right) / 2;
    const glass = mesh(new PlaneGeometry(windowWidth, windowHeight), unlit(windowTexture(index * 7 + 3)), false);
    glass.position.set(x, sill + windowHeight / 2, room.minZ + 0.012);
    // The night view sits just in front and fades in, so dusk blends instead of switching.
    const nightMaterial = unlit(windowTexture(index * 7 + 3, true), true);
    nightMaterial.opacity = 0;
    nightMaterial.depthWrite = false;
    nightGlass.push(nightMaterial);
    const nightPane = mesh(new PlaneGeometry(windowWidth, windowHeight), nightMaterial, false);
    nightPane.position.set(x, sill + windowHeight / 2, room.minZ + 0.014);
    const frame = standard(palette.laminate, 0.5);
    root.add(
      glass,
      box(windowWidth + 0.08, 0.05, 0.05, frame, x, sill - 0.05, room.minZ + 0.02),
      box(windowWidth + 0.08, 0.05, 0.05, frame, x, sill + windowHeight, room.minZ + 0.02),
      box(0.05, windowHeight + 0.05, 0.05, frame, left - 0.02, sill - 0.025, room.minZ + 0.02),
      box(0.05, windowHeight + 0.05, 0.05, frame, right + 0.02, sill - 0.025, room.minZ + 0.02),
      box(0.03, windowHeight, 0.04, frame, x, sill, room.minZ + 0.02),
      nightPane,
    );
  }

  const signY = 1.45;
  const logoMark = mesh(new PlaneGeometry(0.5, 0.5), unlit(logo, true), false);
  logoMark.position.set(-0.28, signY, room.minZ + 0.015);
  const lettering = mesh(new PlaneGeometry(1.1, 0.275), unlit(signTextTexture().texture, true), false);
  lettering.position.set(0.66, signY - 0.02, room.minZ + 0.015);
  root.add(logoMark, lettering, box(1.6, 0.02, 0.03, glow(palette.accent, 1.6), 0.25, signY - 0.33, room.minZ + 0.02));
  return { nightGlass };
}

/**
 * Neon along the top of both walls and along the skirting. The two levels run in opposite
 * directions, so the room frames itself in moving light: the "tech-gaming" layer over a calm office.
 */
function buildNeon(): NeonStrips {
  const back = room.minZ + 0.03;
  const left = room.minX + 0.03;
  const corner = { x: left, z: back };
  const top = room.wallHeight - 0.1;
  const low = 0.12;
  return new NeonStrips([
    { from: { x: room.maxX, z: back }, to: corner, y: top },
    { from: corner, to: { x: left, z: room.maxZ }, y: top },
    { from: { x: room.maxX, z: back }, to: corner, y: low, direction: -1 },
    { from: corner, to: { x: left, z: room.maxZ }, y: low, direction: -1 },
  ]);
}

export function buildOffice(): OfficeProps {
  const root = new Group();
  const logo = new TextureLoader().load(logoUrl);
  logo.colorSpace = SRGBColorSpace;
  const { nightGlass } = buildRoomShell(root, logo);
  const neon = buildNeon();
  root.add(neon.mesh);
  const pingpongBall = mesh(new SphereGeometry(0.018, 12, 8), standard("#fff4e0", 0.4));
  pingpongBall.visible = false;
  root.add(pingpongBall);

  const hairColliders: VRMSpringBoneCollider[] = [];
  const kanban = kanbanTexture();
  const desks: Partial<Record<DeskMember, Workstation>> = {};
  let tv: TvScreen | null = null;
  let arcade: ArcadeScreen | null = null;
  let rackLights: RackLights | null = null;
  let meetingLaptops: LaptopScreen[] = [];
  let fridgeDoor: FridgeDoor | null = null;
  let sink: SinkTap | null = null;
  let oven: Oven | null = null;

  root.add(buildContactShadows(furniture));
  for (const piece of furniture) {
    switch (piece.kind) {
      case "desk-asuna":
      case "desk-kobayashi":
      case "desk-erza":
      case "desk-yor":
      case "desk-twob":
      case "desk-ruby":
      case "desk-rias":
      case "desk-chizuru": {
        const member = piece.kind.slice("desk-".length) as DeskMember;
        const built = buildDesk(member, piece, kanban);
        root.add(built.root);
        desks[member] = built.workstation;
        break;
      }
      case "chair":
      case "sofa": {
        const built =
          piece.kind === "chair"
            ? buildChair(piece, chairSeatHeight)
            : buildSofa(piece, stations["sofa-1"].seatHeight ?? 0.26);
        root.add(built.root);
        hairColliders.push(...built.hairColliders);
        break;
      }
      case "beanbag":
      case "stool": {
        const built =
          piece.kind === "beanbag"
            ? buildBeanbag(
                piece,
                piece.id === "beanbag-chizuru" ? "#d9b48f" : palette.inkSoft,
                stations["beanbag-lounge"].seatHeight ?? 0.17,
              )
            : buildStool(piece, stations["bar-left"].seatHeight ?? 0.42);
        root.add(built.root);
        hairColliders.push(...built.hairColliders);
        break;
      }
      case "meeting-table": {
        const built = buildMeetingTable(piece);
        root.add(built.root);
        meetingLaptops = built.laptops;
        break;
      }
      case "pingpong-table":
        root.add(buildPingpongTable(piece));
        break;
      case "printer-cabinet":
        root.add(buildPrinterCabinet(piece));
        break;
      case "bar-counter":
        root.add(buildBarCounter(piece));
        break;
      case "pantry-counter": {
        const built = buildPantryCounter(piece, {
          coffee: stations.coffee.spot.x,
          sink: stations.sink.spot.x,
          oven: stations.oven.spot.x,
        });
        root.add(built.root);
        sink = built.sink;
        oven = built.oven;
        break;
      }
      case "fridge": {
        const built = buildFridge(piece);
        root.add(built.root);
        fridgeDoor = built.door;
        break;
      }
      case "server-rack": {
        const built = buildServerRack(piece);
        root.add(built.root);
        rackLights = built.lights;
        break;
      }
      case "arcade": {
        const built = buildArcade(piece);
        root.add(built.root);
        arcade = built.screen;
        break;
      }
      case "tv-wall": {
        const built = buildTvWall(piece);
        root.add(built.root);
        tv = built.screen;
        break;
      }
      case "tv-console":
        root.add(buildTvConsole(piece));
        break;
      case "rug":
        root.add(buildRug(piece));
        break;
      case "coffee-table":
        root.add(buildCoffeeTable(piece));
        break;
      case "plant":
        root.add(buildPlant(piece));
        break;
      case "kanban":
        root.add(buildKanban(piece));
        break;
      case "ring-light":
        root.add(buildRingLight(piece));
        break;
      case "camera-tripod":
        root.add(buildCameraTripod(piece));
        break;
      case "backdrop":
        // Light lettering: the wall sign's dark ink would vanish on the backdrop's near-black.
        root.add(buildBackdrop(piece, logo, signTextTexture("#f4f1ec", "#c9a2f5")));
        break;
      case "whiteboard":
      case "idea-board":
        // Built below with their drawing surfaces.
        break;
    }
  }
  if (
    tv === null ||
    arcade === null ||
    rackLights === null ||
    fridgeDoor === null ||
    sink === null ||
    oven === null ||
    meetingLaptops.length !== meetingStationIds.length
  ) {
    throw new Error("Floor plan is missing the TV, arcade, server rack, fridge or meeting table");
  }

  const whiteboardPiece = pieceById("whiteboard");
  const whiteboardSpec: BoardSpec = {
    centerZ: whiteboardPiece.z,
    width: whiteboardPiece.depth,
    // Raised to a normal wall height, and short enough (0.55 m) that standing in front of it a
    // chibi reaches the whole board: shoulders are about 0.7 m up, the arm and hand about 0.3 m.
    bottom: 0.45,
    height: 0.55,
  };
  // Left half (+z side) for 2B's planning, right half for Rias's architecture sketches.
  const whiteboard = new Whiteboard([
    { u0: 0, u1: 0.5, color: "#2f4fa8", diagrams: twobDiagrams },
    { u0: 0.5, u1: 1, color: "#3b3b46", diagrams: riasDiagrams },
  ]);
  root.add(leftWallPlane(whiteboard.texture, whiteboardSpec, palette.frame));

  const ideaPiece = pieceById("idea-board");
  const ideaSpec: BoardSpec = { centerZ: ideaPiece.z, width: ideaPiece.depth, bottom: 0.45, height: 0.55 };
  const ideaBoard = new IdeaBoard();
  root.add(leftWallPlane(ideaBoard.texture, ideaSpec, palette.skirting));

  // Hair stops at the floor too, so the longest strands pool there instead of sinking through.
  // A little above the boards: springs collide at their joints, and the strand mesh reaches a
  // bit past the last joint, so a plane exactly at floor level lets the very tips poke through.
  const floorCollider = new VRMSpringBoneCollider(
    new VRMSpringBoneColliderShapePlane({ normal: new Vector3(0, 1, 0) }),
  );
  floorCollider.position.y = 0.025;
  root.add(floorCollider);
  hairColliders.push(floorCollider);
  root.updateMatrixWorld(true);
  for (const collider of hairColliders) {
    collider.updateWorldMatrix(true, false);
  }

  const workstations = desks as Record<DeskMember, Workstation>;
  return {
    root,
    workstations,
    whiteboard,
    ideaBoard,
    whiteboardPoint: (u, v) => leftWallPoint(whiteboardSpec, u, v),
    ideaBoardPoint: (u, v) => leftWallPoint(ideaSpec, u, v),
    closeups: buildCloseups(whiteboardSpec, ideaSpec),
    hairColliders,
    tv,
    arcade,
    rackLights,
    neon,
    pingpongBall,
    meetingLaptops,
    fridgeDoor,
    sink,
    oven,
    setNight: (night) => {
      for (const material of nightGlass) {
        material.opacity = night;
      }
    },
  };
}

function buildCloseups(whiteboard: BoardSpec, idea: BoardSpec): Record<MemberId, CloseupShot> {
  // Back row: over the right shoulder and a little high, so the head never blocks the monitors.
  const backRowShot = (station: "desk-asuna" | "desk-kobayashi" | "desk-erza" | "desk-yor"): CloseupShot => {
    const seat = stations[station].spot;
    return {
      eye: new Vector3(seat.x + 0.5, 1.12, seat.z + 0.8),
      target: new Vector3(seat.x - 0.02, deskTop + 0.18, seat.z - 0.9),
    };
  };
  // Front desks face the camera with a backdrop or board behind the chair. The shot comes from
  // over the right shoulder and well to the side, so a chibi's big head does not hide the screen
  // and the camera stays clear of the panel behind the chair.
  const frontShot = (station: "desk-twob" | "desk-ruby"): CloseupShot => {
    const seat = stations[station].spot;
    return {
      eye: new Vector3(seat.x + 0.95, 1.0, seat.z - 0.05),
      target: new Vector3(seat.x - 0.15, deskTop + 0.12, seat.z + 0.55),
    };
  };
  // Board shots come from the right-hand side (-Z when facing the left wall) so the writing hand shows.
  const boardShot = (spec: BoardSpec, standZ: number, u: number): CloseupShot => ({
    eye: new Vector3(room.minX + 1.3, 1.0, standZ - 0.8),
    target: leftWallPoint(spec, u, 0.5),
  });
  return {
    asuna: backRowShot("desk-asuna"),
    kobayashi: backRowShot("desk-kobayashi"),
    erza: backRowShot("desk-erza"),
    yor: backRowShot("desk-yor"),
    twob: frontShot("desk-twob"),
    ruby: frontShot("desk-ruby"),
    rias: boardShot(whiteboard, stations["board-rias"].spot.z, 0.72),
    chizuru: boardShot(idea, stations["idea-board"].spot.z, 0.5),
  };
}

/** Shot used when 2B is at the whiteboard instead of her desk. */
export function twobBoardShot(props: OfficeProps): CloseupShot {
  return {
    eye: new Vector3(room.minX + 1.3, 1.0, stations["board-twob"].spot.z - 0.8),
    target: props.whiteboardPoint(0.26, 0.5),
  };
}
