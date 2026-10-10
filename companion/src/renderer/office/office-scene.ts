import { VRMSpringBoneCollider, VRMSpringBoneColliderShapePlane } from "@pixiv/three-vrm";
import { Group, Mesh, PlaneGeometry, SRGBColorSpace, type Texture, TextureLoader, Vector3 } from "three";
import type { MemberId } from "../../shared/team.js";
import logoUrl from "./assets/alyxlabs-logo.png";
import { chairSeatHeight, type Furniture, furniture, room, stations } from "./office-plan.js";
import type { ArcadeScreen, RackLights, TvScreen } from "./scene/animated.js";
import { buildDesk, type DeskMember, deskTop, type Workstation } from "./scene/desks.js";
import {
  buildArcade,
  buildBackdrop,
  buildBarTable,
  buildBeanbag,
  buildCameraTripod,
  buildChair,
  buildCoffeeTable,
  buildFridge,
  buildKanban,
  buildPantryCounter,
  buildPlant,
  buildRingLight,
  buildRug,
  buildServerRack,
  buildSofa,
  buildStool,
  buildTvConsole,
  buildTvWall,
} from "./scene/furniture.js";
import { box, glow, mesh, palette, standard, unlit } from "./scene/palette.js";
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
  const plane = mesh(new PlaneGeometry(spec.width, spec.height), unlit(map), false);
  plane.rotation.y = Math.PI / 2;
  plane.position.set(wallSurfaceX, spec.bottom + spec.height / 2, spec.centerZ);
  group.add(plane);
  return group;
}

function buildRoomShell(root: Group, logo: Texture): void {
  const width = room.maxX - room.minX;
  const depth = room.maxZ - room.minZ;
  const centerX = (room.minX + room.maxX) / 2;
  const centerZ = (room.minZ + room.maxZ) / 2;

  const floorMap = floorTexture();
  floorMap.repeat.set(width / 1.45, depth / 1.45);
  const floor = new Mesh(new PlaneGeometry(width, depth), standard(palette.floor, 0.85));
  (floor.material as ReturnType<typeof standard>).map = floorMap;
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
    // LED cove along the top of both walls: the gaming accent framing the room, kept thin so it reads as trim.
    box(width, 0.025, 0.03, glow(palette.accent, 1.3), centerX, room.wallHeight - 0.12, room.minZ + 0.02),
    box(0.03, 0.025, depth, glow(palette.accent, 1.3), room.minX + 0.02, room.wallHeight - 0.12, centerZ),
  );

  // Two windows over the desks with the sign between them, so the brand sits at the room's focal point.
  for (const [index, [left, right]] of (
    [
      [-3.6, -1.05],
      [1.75, 4.3],
    ] as const
  ).entries()) {
    const windowWidth = right - left;
    const x = (left + right) / 2;
    const glass = mesh(new PlaneGeometry(windowWidth, 1.15), unlit(windowTexture(index * 7 + 3)), false);
    glass.position.set(x, 1.9, room.minZ + 0.012);
    const frame = standard(palette.laminate, 0.5);
    root.add(
      glass,
      box(windowWidth + 0.08, 0.05, 0.05, frame, x, 1.3, room.minZ + 0.02),
      box(windowWidth + 0.08, 0.05, 0.05, frame, x, 2.47, room.minZ + 0.02),
      box(0.05, 1.2, 0.05, frame, left - 0.02, 1.3, room.minZ + 0.02),
      box(0.05, 1.2, 0.05, frame, right + 0.02, 1.3, room.minZ + 0.02),
      box(0.03, 1.15, 0.04, frame, x, 1.32, room.minZ + 0.02),
    );
  }

  const logoMark = mesh(new PlaneGeometry(0.62, 0.62), unlit(logo, true), false);
  logoMark.position.set(-0.32, 1.95, room.minZ + 0.015);
  const lettering = mesh(new PlaneGeometry(1.36, 0.34), unlit(signTextTexture(), true), false);
  lettering.position.set(0.78, 1.93, room.minZ + 0.015);
  root.add(logoMark, lettering, box(1.9, 0.02, 0.03, glow(palette.accent, 1.6), 0.25, 1.55, room.minZ + 0.02));
}

export function buildOffice(): OfficeProps {
  const root = new Group();
  const logo = new TextureLoader().load(logoUrl);
  logo.colorSpace = SRGBColorSpace;
  buildRoomShell(root, logo);

  const hairColliders: VRMSpringBoneCollider[] = [];
  const kanban = kanbanTexture();
  const desks: Partial<Record<DeskMember, Workstation>> = {};
  let tv: TvScreen | null = null;
  let arcade: ArcadeScreen | null = null;
  let rackLights: RackLights | null = null;

  for (const piece of furniture) {
    switch (piece.kind) {
      case "desk-asuna":
      case "desk-kobayashi":
      case "desk-erza":
      case "desk-yor":
      case "desk-twob":
      case "desk-ruby": {
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
        root.add(buildBeanbag(piece, piece.id === "beanbag-chizuru" ? "#d9b48f" : palette.inkSoft).root);
        break;
      case "stool":
        root.add(buildStool(piece, stations["bar-left"].seatHeight ?? 0.42).root);
        break;
      case "bar-table":
        root.add(buildBarTable(piece));
        break;
      case "pantry-counter":
        root.add(buildPantryCounter(piece, stations.coffee.spot.x));
        break;
      case "fridge":
        root.add(buildFridge(piece));
        break;
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
        root.add(buildBackdrop(piece, logo));
        break;
      case "whiteboard":
      case "idea-board":
        // Built below with their drawing surfaces.
        break;
    }
  }
  if (tv === null || arcade === null || rackLights === null) {
    throw new Error("Floor plan is missing the TV, arcade or server rack");
  }

  const whiteboardPiece = pieceById("whiteboard");
  const whiteboardSpec: BoardSpec = {
    centerZ: whiteboardPiece.z,
    width: whiteboardPiece.depth,
    bottom: 0.34,
    height: 0.92,
  };
  // Left half (+z side) for 2B's planning, right half for Rias's architecture sketches.
  const whiteboard = new Whiteboard([
    { u0: 0, u1: 0.5, color: "#2f4fa8", diagrams: twobDiagrams },
    { u0: 0.5, u1: 1, color: "#3b3b46", diagrams: riasDiagrams },
  ]);
  root.add(leftWallPlane(whiteboard.texture, whiteboardSpec, palette.frame));

  const ideaPiece = pieceById("idea-board");
  const ideaSpec: BoardSpec = { centerZ: ideaPiece.z, width: ideaPiece.depth, bottom: 0.36, height: 0.92 };
  const ideaBoard = new IdeaBoard();
  root.add(leftWallPlane(ideaBoard.texture, ideaSpec, palette.skirting));

  // Hair stops at the floor too, so the longest strands pool there instead of sinking through.
  const floorCollider = new VRMSpringBoneCollider(
    new VRMSpringBoneColliderShapePlane({ normal: new Vector3(0, 1, 0) }),
  );
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
  };
}

function buildCloseups(whiteboard: BoardSpec, idea: BoardSpec): Record<MemberId, CloseupShot> {
  // Back row: over the right shoulder and a little high, so the head never blocks the monitors.
  const backRowShot = (station: "desk-asuna" | "desk-kobayashi" | "desk-erza" | "desk-yor"): CloseupShot => {
    const seat = stations[station].spot;
    return {
      eye: new Vector3(seat.x + 0.55, 1.3, seat.z + 0.9),
      target: new Vector3(seat.x - 0.02, deskTop + 0.32, seat.z - 0.95),
    };
  };
  // Front desks face the camera with a backdrop or board behind the chair, so the shot comes from
  // the right-hand side: her profile and the screen both in frame, the camera clear of the panel.
  const frontShot = (station: "desk-twob" | "desk-ruby"): CloseupShot => {
    const seat = stations[station].spot;
    return {
      eye: new Vector3(seat.x + 1.25, 1.2, seat.z + 0.2),
      target: new Vector3(seat.x - 0.1, deskTop + 0.12, seat.z + 0.35),
    };
  };
  // Board shots come from the right-hand side (-Z when facing the left wall) so the writing hand shows.
  const boardShot = (spec: BoardSpec, standZ: number, u: number): CloseupShot => ({
    eye: new Vector3(room.minX + 1.3, 1.15, standZ - 0.8),
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
    eye: new Vector3(room.minX + 1.3, 1.15, stations["board-twob"].spot.z - 0.8),
    target: props.whiteboardPoint(0.26, 0.5),
  };
}
