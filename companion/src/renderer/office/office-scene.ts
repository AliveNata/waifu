import {
  BoxGeometry,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Vector3,
} from "three";
import type { MemberId } from "../../shared/team.js";
import { seatHeight } from "./chibi.js";
import { deskXs, room, stations } from "./office-layout.js";
import { IdeaBoard } from "./surfaces/idea-board.js";
import { Keyboard } from "./surfaces/keyboard.js";
import { ScreenSurface } from "./surfaces/screen.js";
import { screenScripts } from "./surfaces/screen-scripts.js";
import { konanDiagrams, riasDiagrams, Whiteboard } from "./surfaces/whiteboard.js";

/*
 * Palette (antislop R-29/R-31): warm wood and paper walls so the navy
 * furniture, which echoes Konan's hair, reads as the room's one strong color.
 * Screens use each member's own accent so the active desk is easy to spot.
 */
const palette = {
  floor: "#b8946a",
  backWall: "#ebe6dc",
  sideWall: "#ddd6c9",
  skirting: "#8a6e4f",
  deskWood: "#6b4f3a",
  navy: "#2a3557",
  navyDark: "#1d2540",
  boardWhite: "#f6f5ef",
  boardFrame: "#9aa0aa",
  cork: "#b98a5a",
} as const;

function material(color: string): MeshStandardMaterial {
  return new MeshStandardMaterial({ color: new Color(color), roughness: 0.85, flatShading: true });
}

function box(width: number, height: number, depth: number, color: string, x: number, y: number, z: number): Mesh {
  const mesh = new Mesh(new BoxGeometry(width, height, depth), material(color));
  // Boxes are positioned by their bottom face, which keeps furniture math readable.
  mesh.position.set(x, y + height / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Unlit plane showing a canvas texture, so screen text stays readable whatever the lighting. */
function screenPlane(surface: { texture: MeshBasicMaterial["map"] }, width: number, height: number): Mesh {
  return new Mesh(new PlaneGeometry(width, height), new MeshBasicMaterial({ map: surface.texture, toneMapped: false }));
}

export type DeskMember = Exclude<MemberId, "rias" | "chizuru">;

export interface Workstation {
  screen: ScreenSurface;
  keyboard: Keyboard;
}

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
}

export const deskTop = 0.55;
const deskDepth = 0.7;
const deskCenterZ = room.minZ + 0.4;

const whiteboardSpec = { centerZ: -1.6, width: 2.6, bottom: 0.25, height: 0.85 };
const ideaBoardSpec = { centerZ: 1.0, width: 1.6, bottom: 0.3, height: 0.9 };
const wallSurfaceX = room.minX + 0.07;

function leftWallPoint(spec: typeof whiteboardSpec, u: number, v: number): Vector3 {
  // Facing the left wall, board "left" is +Z, so u grows toward -Z.
  const z = spec.centerZ + spec.width / 2 - u * spec.width;
  const y = spec.bottom + spec.height * (1 - v);
  return new Vector3(wallSurfaceX + 0.02, y, z);
}

function buildDesk(root: Group, memberId: DeskMember, x: number): Workstation {
  const screen = new ScreenSurface(screenScripts[memberId]);
  const keyboard = new Keyboard(screenScripts[memberId].theme.accent);

  root.add(
    box(1.4, 0.05, deskDepth, palette.deskWood, x, deskTop - 0.05, deskCenterZ),
    box(0.06, deskTop - 0.05, deskDepth - 0.1, palette.deskWood, x - 0.67, 0, deskCenterZ),
    box(0.06, deskTop - 0.05, deskDepth - 0.1, palette.deskWood, x + 0.67, 0, deskCenterZ),
    box(0.06, 0.12, 0.06, palette.navyDark, x, deskTop, deskCenterZ - 0.18),
    box(0.68, 0.42, 0.04, palette.navyDark, x, deskTop + 0.1, deskCenterZ - 0.2),
  );
  const plane = screenPlane(screen, 0.64, 0.4);
  plane.position.set(x, deskTop + 0.31, deskCenterZ - 0.177);
  root.add(plane);

  keyboard.root.position.set(x, deskTop, room.minZ + deskDepth + 0.03);
  root.add(keyboard.root);

  // Chair under the seat spot, backrest behind the sitter.
  const seat = stations[`desk-${memberId}` as const].spot;
  root.add(
    box(0.42, 0.05, 0.42, palette.navy, seat.x, seatHeight - 0.05, seat.z),
    box(0.42, 0.42, 0.05, palette.navy, seat.x, seatHeight, seat.z + 0.22),
    box(0.05, seatHeight - 0.05, 0.05, palette.navyDark, seat.x, 0, seat.z),
  );
  return { screen, keyboard };
}

function buildKonanDesk(root: Group): Workstation {
  const screen = new ScreenSurface(screenScripts.konan);
  const keyboard = new Keyboard(screenScripts.konan.theme.accent, "#c9c4ba", "#e9e5dc");
  const seat = stations["desk-konan"].spot;
  const deskZ = seat.z + 0.55;
  root.add(
    box(1.2, 0.05, 0.6, palette.deskWood, seat.x, deskTop - 0.05, deskZ),
    box(0.06, deskTop - 0.05, 0.5, palette.deskWood, seat.x - 0.57, 0, deskZ),
    box(0.06, deskTop - 0.05, 0.5, palette.deskWood, seat.x + 0.57, 0, deskZ),
    box(0.42, 0.42, 0.05, palette.navy, seat.x, seatHeight, seat.z - 0.22),
    box(0.42, 0.05, 0.42, palette.navy, seat.x, seatHeight - 0.05, seat.z),
    box(0.05, seatHeight - 0.05, 0.05, palette.navyDark, seat.x, 0, seat.z),
  );
  // Laptop: the keyboard is the base, the lid leans back and faces her (-Z side).
  keyboard.root.position.set(seat.x, deskTop, deskZ - 0.12);
  keyboard.root.rotation.y = Math.PI;
  root.add(keyboard.root);
  const lid = new Group();
  lid.position.set(seat.x, deskTop + 0.01, deskZ + 0.02);
  lid.rotation.x = -0.25;
  const back = new Mesh(new BoxGeometry(0.46, 0.3, 0.015), material("#c9c4ba"));
  back.position.set(0, 0.15, 0.01);
  back.castShadow = true;
  const plane = screenPlane(screen, 0.44, 0.275);
  plane.rotation.y = Math.PI;
  plane.position.set(0, 0.15, 0);
  lid.add(back, plane);
  root.add(lid);
  return { screen, keyboard };
}

export function buildOffice(): OfficeProps {
  const root = new Group();
  const width = room.maxX - room.minX;
  const depth = room.maxZ - room.minZ;
  const centerX = (room.minX + room.maxX) / 2;
  const centerZ = (room.minZ + room.maxZ) / 2;

  const floor = new Mesh(new PlaneGeometry(width, depth), material(palette.floor));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(centerX, 0, centerZ);
  floor.receiveShadow = true;
  root.add(floor);

  const wallThickness = 0.12;
  root.add(
    box(width, room.wallHeight, wallThickness, palette.backWall, centerX, 0, room.minZ - wallThickness / 2),
    box(wallThickness, room.wallHeight, depth, palette.sideWall, room.minX - wallThickness / 2, 0, centerZ),
    box(width, 0.1, 0.03, palette.skirting, centerX, 0, room.minZ + 0.015),
    box(0.03, 0.1, depth, palette.skirting, room.minX + 0.015, 0, centerZ),
  );

  const workstations: Record<DeskMember, Workstation> = {
    asuna: buildDesk(root, "asuna", deskXs.asuna),
    kobayashi: buildDesk(root, "kobayashi", deskXs.kobayashi),
    yor: buildDesk(root, "yor", deskXs.yor),
    erza: buildDesk(root, "erza", deskXs.erza),
    konan: buildKonanDesk(root),
  };

  // Whiteboard: left half for Konan's planning, right half for Rias's architecture sketches.
  const whiteboard = new Whiteboard([
    { u0: 0, u1: 0.5, color: "#2f4fa8", diagrams: konanDiagrams },
    { u0: 0.5, u1: 1, color: "#3b3b46", diagrams: riasDiagrams },
  ]);
  const wb = whiteboardSpec;
  root.add(
    box(0.04, wb.height + 0.08, wb.width + 0.08, palette.boardFrame, room.minX + 0.03, wb.bottom - 0.04, wb.centerZ),
  );
  const whiteboardPlane = screenPlane(whiteboard, wb.width, wb.height);
  whiteboardPlane.rotation.y = Math.PI / 2;
  whiteboardPlane.position.set(wallSurfaceX, wb.bottom + wb.height / 2, wb.centerZ);
  root.add(whiteboardPlane);

  const ideaBoard = new IdeaBoard();
  const ib = ideaBoardSpec;
  root.add(
    box(0.04, ib.height + 0.08, ib.width + 0.08, palette.skirting, room.minX + 0.03, ib.bottom - 0.04, ib.centerZ),
  );
  const ideaPlane = screenPlane(ideaBoard, ib.width, ib.height);
  ideaPlane.rotation.y = Math.PI / 2;
  ideaPlane.position.set(wallSurfaceX, ib.bottom + ib.height / 2, ib.centerZ);
  root.add(ideaPlane);

  // Sofa against the left wall, facing into the room.
  const sofa = stations.sofa.spot;
  root.add(
    box(0.7, seatHeight, 1.6, palette.navy, room.minX + 0.4, 0, sofa.z),
    box(0.22, 0.72, 1.6, palette.navyDark, room.minX + 0.11, 0, sofa.z),
    box(0.7, 0.45, 0.18, palette.navyDark, room.minX + 0.4, 0, sofa.z - 0.8),
    box(0.7, 0.45, 0.18, palette.navyDark, room.minX + 0.4, 0, Math.min(room.maxZ - 0.09, sofa.z + 0.8)),
  );

  // Over the right shoulder and a little high, so the head never blocks the screen.
  const deskShot = (x: number): CloseupShot => ({
    eye: new Vector3(x + 0.5, 1.28, deskCenterZ + 0.85),
    target: new Vector3(x - 0.02, deskTop + 0.2, deskCenterZ - 0.15),
  });
  const konanSeat = stations["desk-konan"].spot;
  const closeups: Record<MemberId, CloseupShot> = {
    asuna: deskShot(deskXs.asuna),
    kobayashi: deskShot(deskXs.kobayashi),
    yor: deskShot(deskXs.yor),
    erza: deskShot(deskXs.erza),
    // Board shots come from the right-hand side (-Z when facing the left wall) so the writing hand shows.
    rias: { eye: new Vector3(-3.75, 1.1, -3.3), target: leftWallPoint(wb, 0.72, 0.5) },
    chizuru: { eye: new Vector3(-3.75, 1.1, -0.1), target: leftWallPoint(ib, 0.5, 0.5) },
    konan: {
      eye: new Vector3(konanSeat.x + 0.45, 1.25, konanSeat.z - 0.55),
      target: new Vector3(konanSeat.x, deskTop + 0.15, konanSeat.z + 0.6),
    },
  };

  return {
    root,
    workstations,
    whiteboard,
    ideaBoard,
    whiteboardPoint: (u, v) => leftWallPoint(wb, u, v),
    ideaBoardPoint: (u, v) => leftWallPoint(ib, u, v),
    closeups,
  };
}

/** Shot used when Konan is at the whiteboard instead of her desk. */
export function konanBoardShot(props: OfficeProps): CloseupShot {
  return { eye: new Vector3(-3.75, 1.1, -2.0), target: props.whiteboardPoint(0.26, 0.5) };
}
