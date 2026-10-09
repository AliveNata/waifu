import { BoxGeometry, Color, Group, Mesh, MeshStandardMaterial, PlaneGeometry } from "three";
import { seatHeight } from "./chibi.js";
import { room, stations } from "./office-layout.js";

/*
 * Palette (antislop R-29/R-31): warm wood and paper walls so the navy
 * furniture, which echoes Xenovia's hair, reads as the room's one strong color.
 */
const palette = {
  floor: "#b8946a",
  backWall: "#ebe6dc",
  sideWall: "#ddd6c9",
  skirting: "#8a6e4f",
  deskWood: "#6b4f3a",
  navy: "#2a3557",
  navyDark: "#1d2540",
  screenOff: "#1b2030",
  screenOn: "#7fa6d9",
  boardWhite: "#f6f5ef",
  boardFrame: "#9aa0aa",
  ink: "#3b4660",
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

export interface OfficeProps {
  root: Group;
  /** The monitor face. Its emissive glow tracks whether Xenovia is working. */
  screen: MeshStandardMaterial;
}

export function buildOffice(): OfficeProps {
  const root = new Group();
  const width = room.maxX - room.minX;
  const depth = room.maxZ - room.minZ;

  const floor = new Mesh(new PlaneGeometry(width, depth), material(palette.floor));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  root.add(floor);

  const wallThickness = 0.12;
  root.add(
    box(width, room.wallHeight, wallThickness, palette.backWall, 0, 0, room.minZ - wallThickness / 2),
    box(wallThickness, room.wallHeight, depth, palette.sideWall, room.minX - wallThickness / 2, 0, 0),
    box(width, 0.1, 0.03, palette.skirting, 0, 0, room.minZ + 0.015),
    box(0.03, 0.1, depth, palette.skirting, room.minX + 0.015, 0, 0),
  );

  // Desk against the back wall, chair where the desk station spot is.
  const desk = stations.desk.spot;
  const deskZ = room.minZ + 0.4;
  const deskTop = 0.55;
  root.add(
    box(1.5, 0.05, 0.7, palette.deskWood, desk.x, deskTop - 0.05, deskZ),
    box(0.06, deskTop - 0.05, 0.6, palette.deskWood, desk.x - 0.7, 0, deskZ),
    box(0.06, deskTop - 0.05, 0.6, palette.deskWood, desk.x + 0.7, 0, deskZ),
    box(0.06, 0.28, 0.06, palette.navyDark, desk.x, deskTop, deskZ - 0.15),
  );
  const screen = material(palette.screenOff);
  const monitor = new Mesh(new BoxGeometry(0.7, 0.42, 0.04), [
    material(palette.navyDark),
    material(palette.navyDark),
    material(palette.navyDark),
    material(palette.navyDark),
    screen,
    material(palette.navyDark),
  ]);
  monitor.position.set(desk.x, deskTop + 0.45, deskZ - 0.12);
  monitor.castShadow = true;
  root.add(monitor, box(0.55, 0.02, 0.18, palette.navyDark, desk.x, deskTop, deskZ + 0.12));

  const chairZ = desk.z + 0.05;
  root.add(
    box(0.5, 0.06, 0.5, palette.navy, desk.x, seatHeight - 0.06, chairZ),
    box(0.5, 0.5, 0.06, palette.navy, desk.x, seatHeight, chairZ + 0.25),
    box(0.06, seatHeight - 0.06, 0.06, palette.navyDark, desk.x, 0, chairZ),
  );

  // Whiteboard on the left wall with a few marker strokes.
  const board = stations.whiteboard.spot;
  const boardX = room.minX + 0.05;
  // Hung low: the chibi is about a meter tall and should reach it.
  root.add(
    box(0.04, 0.95, 1.7, palette.boardFrame, boardX, 0.4, board.z),
    box(0.02, 0.85, 1.6, palette.boardWhite, boardX + 0.03, 0.45, board.z),
    box(0.01, 0.03, 0.9, palette.ink, boardX + 0.045, 1.1, board.z - 0.2),
    box(0.01, 0.03, 0.6, palette.ink, boardX + 0.045, 0.95, board.z - 0.35),
    box(0.01, 0.03, 1.1, palette.ink, boardX + 0.045, 0.8, board.z + 0.1),
  );

  // Sofa against the back wall.
  const sofa = stations.sofa.spot;
  const sofaBackZ = room.minZ + 0.2;
  root.add(
    box(1.8, seatHeight, 0.75, palette.navy, sofa.x, 0, sofa.z - 0.05),
    box(1.8, 0.75, 0.25, palette.navyDark, sofa.x, 0, sofaBackZ),
    box(0.2, 0.5, 0.75, palette.navyDark, sofa.x - 0.9, 0, sofa.z - 0.05),
    box(0.2, 0.5, 0.75, palette.navyDark, sofa.x + 0.9, 0, sofa.z - 0.05),
  );

  return { root, screen };
}

export function setScreenOn(screen: MeshStandardMaterial, on: boolean): void {
  const color = on ? palette.screenOn : palette.screenOff;
  screen.color.set(color);
  screen.emissive.set(on ? palette.screenOn : "#000000");
  screen.emissiveIntensity = on ? 0.6 : 0;
}
