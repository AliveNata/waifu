/**
 * AlyxLabs floor plan as data. The scene builds furniture meshes from it, the
 * navigation grid treats furniture footprints as walls, and stations say where
 * a character stands or sits to use something. Keeping all three on one list
 * means a moved desk can never leave its chair or its walkway behind.
 *
 * World axes: x grows to the right, z grows toward the camera. The back wall
 * sits at z = minZ and the left wall at x = minX; the camera looks in from +x/+z.
 */

export interface Point {
  x: number;
  z: number;
}

/** Walls are 2.2 m: tall for a chibi, but not so tall the room swallows them like a warehouse. */
export const room = { minX: -7, maxX: 7, minZ: -5, maxZ: 4, wallHeight: 2.2 } as const;

/**
 * Everything is sized for chibi people, not adults. A standing chibi is about 1.05 m with its
 * eyes near 0.88 m; seated, the eyes sit near 0.72 m and the hands reach up to about 1.0 m.
 * Work surfaces, screens and boards are placed against these numbers, so nobody types into a
 * counter at chin height or watches a screen above their head.
 */
export const chibi = { standing: 1.05, eye: 0.88, seatedEye: 0.72, reach: 1.0 } as const;

/** Heights of the surfaces people use, scaled from adult furniture by roughly 0.65. */
export const surface = { desk: 0.55, counter: 0.58, barTable: 0.72, pingpong: 0.48, coffeeTable: 0.26 } as const;

/** Yaw that faces the camera, which looks in along the +x/+z diagonal. */
export const facingCamera = Math.PI / 4;

/** Yaw conventions: 0 faces +Z (toward the camera), PI faces the back wall, -PI/2 faces the left wall. */
export const facing = { camera: 0, backWall: Math.PI, leftWall: -Math.PI / 2, right: Math.PI / 2 } as const;

export type FurnitureKind =
  | "desk-asuna"
  | "desk-kobayashi"
  | "desk-erza"
  | "desk-yor"
  | "desk-twob"
  | "desk-ruby"
  | "desk-rias"
  | "desk-chizuru"
  | "chair"
  | "server-rack"
  | "arcade"
  | "pantry-counter"
  | "fridge"
  | "bar-counter"
  | "stool"
  | "whiteboard"
  | "idea-board"
  | "tv-wall"
  | "tv-console"
  | "sofa"
  | "coffee-table"
  | "beanbag"
  | "rug"
  | "plant"
  | "kanban"
  | "ring-light"
  | "camera-tripod"
  | "backdrop"
  | "meeting-table"
  | "pingpong-table"
  | "printer-cabinet";

export interface Furniture {
  id: string;
  kind: FurnitureKind;
  /** Footprint center. */
  x: number;
  z: number;
  /** Footprint size along x and z, in meters. */
  width: number;
  depth: number;
  /** Yaw the piece faces (its "front"), same convention as stations. */
  yaw: number;
  /**
   * False only for things people walk over, such as rugs. Seats block too: their sitter steps
   * onto the spot from the approach point as the last move, everybody else walks around.
   */
  blocksWalking: boolean;
}

export type StationId =
  | "desk-asuna"
  | "desk-kobayashi"
  | "desk-erza"
  | "desk-yor"
  | "desk-twob"
  | "desk-ruby"
  | "desk-rias"
  | "desk-chizuru"
  | "board-rias"
  | "board-twob"
  | "idea-board"
  | "beanbag-chizuru"
  | "front"
  | "coffee"
  | "fridge"
  | "sink"
  | "oven"
  | "bar-left"
  | "bar-right"
  | "sofa-1"
  | "sofa-2"
  | "sofa-3"
  | "beanbag-lounge"
  | "arcade"
  | "rack"
  | "selfie"
  | "plant-lounge"
  | "plant-corner"
  | "plant-desks"
  | "plant-center"
  | "meeting-1"
  | "meeting-2"
  | "meeting-3"
  | "meeting-4"
  | "meeting-5"
  | "meeting-6"
  | "pingpong-west"
  | "pingpong-east";

export interface Station {
  id: StationId;
  /** Where the character stands, or the point under the hips when seated. */
  spot: Point;
  facing: number;
  /** Walkable point just outside the furniture where the character steps on and off. */
  approach: Point;
  /** Seat surface height in meters, or null when standing. */
  seatHeight: number | null;
}

/** Pulled up close, about as far from the desk edge as the front desks' chairs, so short arms reach the keys. */
const deskRowSeatZ = -3.92;
/** Office chairs are sized for chibi legs: low enough that most feet reach the floor. */
export const chairSeatHeight = 0.28;
const sofaSeatHeight = 0.26;
/**
 * The lane between the sofa and the coffee table. The sofa faces the TV with its back to the
 * room, so sitters walk in along this lane from the north end and sit down from the front.
 */
const sofaFrontX = -5.4;
const stoolSeatHeight = 0.42;
/** The cushion surface of the reshaped beanbag, so sitters rest on it instead of sinking in. */
const beanbagSeatHeight = 0.17;

/** x of each back-row desk, left to right. Yor sits next to her server rack. */
export const deskRowX = { asuna: -2.7, kobayashi: -0.7, erza: 1.3, yor: 3.3 } as const;

/** Back-row desks are 1.6 m wide and 0.8 m deep, flush against the back wall. */
const deskRow: Furniture[] = (Object.entries(deskRowX) as [keyof typeof deskRowX, number][]).flatMap(([member, x]) => [
  {
    id: `desk-${member}`,
    kind: `desk-${member}`,
    x,
    z: -4.55,
    width: 1.6,
    depth: 0.8,
    yaw: facing.camera,
    blocksWalking: true,
  },
  {
    id: `chair-${member}`,
    kind: "chair",
    x,
    z: deskRowSeatZ,
    width: 0.5,
    depth: 0.5,
    yaw: facing.backWall,
    blocksWalking: true,
  },
]);

const frontDeskZ = 1.95;

/** x of the front-row desks east of 2B's. */
const frontRowDeskX = { rias: 4.55, chizuru: 6.1 } as const;

/** Where Ruby sits at her desk; her camera and ring light both aim here. */
const rubySeat = { x: -1.9, z: 1.4 } as const;

const meetingIds = ["meeting-1", "meeting-2", "meeting-3", "meeting-4", "meeting-5", "meeting-6"] as const;
export type MeetingStationId = (typeof meetingIds)[number];

/** The meeting table's middle, and its six chairs: three on the back side facing the camera, three in front. */
const meetingTableX = -0.6;
const meetingSeatXs = [meetingTableX - 0.8, meetingTableX, meetingTableX + 0.8] as const;
const meetingSeats = [
  ...meetingSeatXs.map((x) => ({ x, z: -2.05, yaw: facing.camera })),
  ...meetingSeatXs.map((x) => ({ x, z: -0.55, yaw: facing.backWall })),
] as const;

/**
 * The pantry is an L: the counter along the back wall, and at its east end a raised bar running
 * out into the room with two stools on its outer side.
 */
const barCounter = { x: -3.86, z: -3.86, width: 0.48, depth: 2.22 } as const;
const barStoolX = -3.33;
const barStools = [
  // Turned a little toward each other, so the two can talk without twisting round.
  { id: "stool-left", z: -3.5, yaw: facing.leftWall + 0.4 },
  { id: "stool-right", z: -2.95, yaw: facing.leftWall - 0.4 },
] as const;
/** Where the sink and oven sit along the pantry counter; the coffee machine is between them. */
const sinkX = -5.85;
const ovenX = -4.55;

export const furniture: readonly Furniture[] = [
  ...deskRow,
  // Creator and command desks face the camera, so the room reads as "people at work" from the default view.
  {
    id: "desk-ruby",
    kind: "desk-ruby",
    x: -1.9,
    z: frontDeskZ,
    width: 1.3,
    depth: 0.65,
    yaw: facing.backWall,
    blocksWalking: true,
  },
  {
    id: "chair-ruby",
    kind: "chair",
    x: -1.9,
    z: 1.4,
    width: 0.5,
    depth: 0.5,
    yaw: facing.camera,
    blocksWalking: true,
  },
  {
    id: "backdrop",
    kind: "backdrop",
    x: -1.9,
    z: 0.72,
    width: 1.5,
    depth: 0.12,
    yaw: facing.camera,
    blocksWalking: true,
  },
  {
    id: "ring-light",
    kind: "ring-light",
    x: -2.85,
    z: 1.75,
    width: 0.35,
    depth: 0.35,
    // Lights Ruby's face at her desk, from her front left, like a key light.
    yaw: yawToward({ x: -2.85, z: 1.75 }, rubySeat),
    blocksWalking: true,
  },
  {
    id: "camera-tripod",
    kind: "camera-tripod",
    x: -1.0,
    z: 2.75,
    width: 0.4,
    depth: 0.4,
    // The lens points at Ruby in her chair, the same subject the ring light is lighting.
    yaw: yawToward({ x: -1.0, z: 2.75 }, rubySeat),
    blocksWalking: true,
  },
  {
    id: "desk-twob",
    kind: "desk-twob",
    x: 2.4,
    z: frontDeskZ,
    width: 1.6,
    depth: 0.7,
    yaw: facing.backWall,
    blocksWalking: true,
  },
  { id: "chair-twob", kind: "chair", x: 2.4, z: 1.4, width: 0.5, depth: 0.5, yaw: facing.camera, blocksWalking: true },
  // Rias and Chizuru work at their boards, but between tasks they have desks of their own in the
  // front row, facing the camera like Ruby's and 2B's.
  ...(["rias", "chizuru"] as const).flatMap((member): Furniture[] => [
    {
      id: `desk-${member}`,
      kind: `desk-${member}`,
      x: frontRowDeskX[member],
      z: frontDeskZ,
      width: 1.3,
      depth: 0.65,
      yaw: facing.backWall,
      blocksWalking: true,
    },
    {
      id: `chair-${member}`,
      kind: "chair",
      x: frontRowDeskX[member],
      z: 1.4,
      width: 0.5,
      depth: 0.5,
      yaw: facing.camera,
      blocksWalking: true,
    },
  ]),
  { id: "kanban", kind: "kanban", x: 2.4, z: 0.55, width: 1.3, depth: 0.12, yaw: facing.camera, blocksWalking: true },

  {
    id: "server-rack",
    kind: "server-rack",
    x: 5.15,
    z: -4.6,
    width: 0.7,
    depth: 0.7,
    yaw: facing.camera,
    blocksWalking: true,
  },
  { id: "arcade", kind: "arcade", x: 6.35, z: -4.55, width: 0.8, depth: 0.8, yaw: facing.camera, blocksWalking: true },

  { id: "fridge", kind: "fridge", x: -6.6, z: -4.62, width: 0.7, depth: 0.7, yaw: facing.camera, blocksWalking: true },
  {
    id: "pantry-counter",
    kind: "pantry-counter",
    x: -5.15,
    z: -4.65,
    width: 2.1,
    depth: 0.65,
    yaw: facing.camera,
    blocksWalking: true,
  },
  {
    id: "bar-counter",
    kind: "bar-counter",
    x: barCounter.x,
    z: barCounter.z,
    width: barCounter.width,
    depth: barCounter.depth,
    yaw: facing.camera,
    blocksWalking: true,
  },
  ...barStools.map(
    (stool): Furniture => ({
      id: stool.id,
      kind: "stool",
      x: barStoolX,
      z: stool.z,
      width: 0.36,
      depth: 0.36,
      yaw: stool.yaw,
      blocksWalking: true,
    }),
  ),

  {
    id: "whiteboard",
    kind: "whiteboard",
    x: -6.95,
    z: -2.0,
    width: 0.1,
    // 2.2 x 0.55 m: short enough that a chibi standing in front reaches the top line.
    depth: 2.2,
    yaw: facing.right,
    blocksWalking: true,
  },
  {
    id: "idea-board",
    kind: "idea-board",
    x: -6.95,
    z: 0.55,
    width: 0.1,
    depth: 1.3,
    yaw: facing.right,
    blocksWalking: true,
  },
  {
    id: "beanbag-chizuru",
    kind: "beanbag",
    // Clear of the sofa lane's entrance, which needs room for two people to pass.
    x: -5.7,
    z: 0.7,
    width: 0.7,
    depth: 0.7,
    yaw: facingCamera,
    blocksWalking: true,
  },

  { id: "tv-wall", kind: "tv-wall", x: -6.95, z: 2.95, width: 0.1, depth: 1.7, yaw: facing.right, blocksWalking: true },
  {
    id: "tv-console",
    kind: "tv-console",
    x: -6.72,
    z: 2.95,
    width: 0.5,
    depth: 1.6,
    yaw: facing.right,
    blocksWalking: true,
  },
  { id: "rug", kind: "rug", x: -5.4, z: 2.95, width: 2.6, depth: 2.0, yaw: facing.right, blocksWalking: false },
  {
    id: "coffee-table",
    kind: "coffee-table",
    // Slim and close to the TV, so two people can pass in the lane in front of the sofa.
    x: -6.1,
    z: 3.0,
    width: 0.4,
    depth: 0.9,
    yaw: facing.right,
    blocksWalking: true,
  },
  { id: "sofa", kind: "sofa", x: -4.55, z: 3.0, width: 0.7, depth: 1.8, yaw: facing.leftWall, blocksWalking: true },
  {
    id: "beanbag-lounge",
    kind: "beanbag",
    // Tucked by the wall so it no longer blocks the way into the sofa lane.
    x: -6.3,
    z: 1.75,
    width: 0.7,
    depth: 0.7,
    yaw: yawToward({ x: -6.3, z: 1.75 }, { x: -6.95, z: 2.95 }),
    blocksWalking: true,
  },

  {
    id: "plant-lounge",
    kind: "plant",
    // Behind the sofa's open side: the left-wall corner is boxed in by the beanbags and the
    // coffee table, so a plant there could never be reached for watering.
    x: -3.0,
    z: 3.6,
    width: 0.5,
    depth: 0.5,
    yaw: facing.camera,
    blocksWalking: true,
  },
  {
    id: "plant-corner",
    kind: "plant",
    x: 6.4,
    z: 3.4,
    width: 0.6,
    depth: 0.6,
    yaw: facing.camera,
    blocksWalking: true,
  },
  {
    id: "plant-desks",
    kind: "plant",
    x: 4.55,
    z: -4.65,
    width: 0.4,
    depth: 0.4,
    yaw: facing.camera,
    blocksWalking: true,
  },
  {
    id: "plant-center",
    kind: "plant",
    x: 1.45,
    z: -0.35,
    width: 0.5,
    depth: 0.5,
    yaw: facing.camera,
    blocksWalking: true,
  },
  // Center of the room: a team table for standups and laptop work, and a ping-pong table for two.
  {
    id: "meeting-table",
    kind: "meeting-table",
    x: meetingTableX,
    z: -1.3,
    width: 2.6,
    depth: 0.9,
    yaw: facing.camera,
    blocksWalking: true,
  },
  ...meetingSeats.map(
    (seat, index): Furniture => ({
      id: `chair-meeting-${index + 1}`,
      kind: "chair",
      x: seat.x,
      z: seat.z,
      width: 0.5,
      depth: 0.5,
      yaw: seat.yaw,
      blocksWalking: true,
    }),
  ),
  {
    id: "pingpong-table",
    kind: "pingpong-table",
    x: 3.3,
    z: -1.2,
    width: 1.5,
    depth: 0.85,
    yaw: facing.camera,
    blocksWalking: true,
  },
  // Printer cabinets: one in the back row next to Erza, one beside 2B's desk.
  {
    id: "printer-back",
    kind: "printer-cabinet",
    x: 0.3,
    z: -4.6,
    width: 0.36,
    depth: 0.6,
    yaw: facing.camera,
    blocksWalking: true,
  },
  {
    id: "printer-twob",
    kind: "printer-cabinet",
    x: 1.15,
    z: 1.95,
    width: 0.45,
    depth: 0.5,
    yaw: facing.backWall,
    blocksWalking: true,
  },
  {
    id: "plant-entry",
    kind: "plant",
    x: 6.45,
    z: -1.6,
    width: 0.5,
    depth: 0.5,
    yaw: facing.camera,
    blocksWalking: true,
  },
];

/**
 * Chairs are entered from the side, the way people pull up to a desk: coming in from behind
 * would walk the sitter straight through the backrest.
 */
const chairSideStep = 0.55;

function deskRowStation(id: StationId, x: number): Station {
  return {
    id,
    spot: { x, z: deskRowSeatZ },
    facing: facing.backWall,
    approach: { x: x + chairSideStep, z: deskRowSeatZ },
    seatHeight: chairSeatHeight,
  };
}

function frontRowStation(id: StationId, x: number): Station {
  return {
    id,
    spot: { x, z: 1.4 },
    facing: facing.camera,
    approach: { x: x + chairSideStep, z: 1.4 },
    seatHeight: chairSeatHeight,
  };
}

function standing(id: StationId, spot: Point, yaw: number, approach: Point = spot): Station {
  return { id, spot, facing: yaw, approach, seatHeight: null };
}

/** Yaw that turns someone at `from` toward `to`. */
export function yawToward(from: Point, to: Point): number {
  return Math.atan2(to.x - from.x, to.z - from.z);
}

/** Close enough to the boards (surface at x -6.91) that a chibi arm reaches the writing. */
const boardStandX = -6.68;

export const stations: Record<StationId, Station> = {
  "desk-asuna": deskRowStation("desk-asuna", deskRowX.asuna),
  "desk-kobayashi": deskRowStation("desk-kobayashi", deskRowX.kobayashi),
  "desk-erza": deskRowStation("desk-erza", deskRowX.erza),
  "desk-yor": deskRowStation("desk-yor", deskRowX.yor),
  "desk-ruby": {
    id: "desk-ruby",
    spot: rubySeat,
    facing: facing.camera,
    approach: { x: -1.9 + chairSideStep, z: 1.4 },
    seatHeight: chairSeatHeight,
  },
  "desk-twob": {
    id: "desk-twob",
    spot: { x: 2.4, z: 1.4 },
    facing: facing.camera,
    approach: { x: 2.4 + chairSideStep, z: 1.4 },
    seatHeight: chairSeatHeight,
  },
  "desk-rias": frontRowStation("desk-rias", frontRowDeskX.rias),
  "desk-chizuru": frontRowStation("desk-chizuru", frontRowDeskX.chizuru),
  // Facing the left wall, the board's left half (+z side) is 2B's plan and the right half Rias's sketches.
  "board-twob": standing("board-twob", { x: boardStandX, z: -1.4 }, facing.leftWall),
  "board-rias": standing("board-rias", { x: boardStandX, z: -2.65 }, facing.leftWall),
  "idea-board": standing("idea-board", { x: boardStandX, z: 0.4 }, facing.leftWall),
  "beanbag-chizuru": {
    id: "beanbag-chizuru",
    spot: { x: -5.7, z: 0.7 },
    facing: facingCamera,
    approach: { x: -5.0, z: 0.55 },
    seatHeight: beanbagSeatHeight,
  },
  front: standing("front", { x: 0.4, z: 3.0 }, facingCamera),
  coffee: standing("coffee", { x: -5.35, z: -3.95 }, facing.backWall),
  fridge: standing("fridge", { x: -6.55, z: -3.85 }, facing.backWall),
  sink: standing("sink", { x: sinkX, z: -3.95 }, facing.backWall),
  oven: standing("oven", { x: ovenX, z: -3.85 }, facing.backWall),
  "bar-left": {
    id: "bar-left",
    spot: { x: barStoolX, z: barStools[0].z },
    facing: barStools[0].yaw,
    approach: { x: barStoolX + 0.5, z: barStools[0].z },
    seatHeight: stoolSeatHeight,
  },
  "bar-right": {
    id: "bar-right",
    spot: { x: barStoolX, z: barStools[1].z },
    facing: barStools[1].yaw,
    approach: { x: barStoolX + 0.5, z: barStools[1].z },
    seatHeight: stoolSeatHeight,
  },
  "sofa-1": {
    id: "sofa-1",
    spot: { x: -4.62, z: 2.4 },
    facing: facing.leftWall,
    approach: { x: sofaFrontX, z: 2.4 },
    seatHeight: sofaSeatHeight,
  },
  "sofa-2": {
    id: "sofa-2",
    spot: { x: -4.62, z: 3.0 },
    facing: facing.leftWall,
    approach: { x: sofaFrontX, z: 3.0 },
    seatHeight: sofaSeatHeight,
  },
  "sofa-3": {
    id: "sofa-3",
    spot: { x: -4.62, z: 3.6 },
    facing: facing.leftWall,
    approach: { x: sofaFrontX, z: 3.6 },
    seatHeight: sofaSeatHeight,
  },
  "beanbag-lounge": {
    id: "beanbag-lounge",
    spot: { x: -6.3, z: 1.75 },
    facing: yawToward({ x: -6.3, z: 1.75 }, { x: -6.95, z: 2.95 }),
    approach: { x: -5.6, z: 1.6 },
    seatHeight: beanbagSeatHeight,
  },
  arcade: standing("arcade", { x: 6.35, z: -3.8 }, facing.backWall),
  rack: standing("rack", { x: 5.15, z: -3.85 }, facing.backWall),
  // In front of her backdrop, so the ring light and camera frame her like a real shoot.
  selfie: standing("selfie", { x: -2.75, z: 1.05 }, yawToward({ x: -2.75, z: 1.05 }, { x: -1.0, z: 2.75 })),
  "plant-lounge": standing("plant-lounge", { x: -3.0, z: 3.0 }, facing.camera),
  "plant-corner": standing("plant-corner", { x: 5.85, z: 3.05 }, yawToward({ x: 5.85, z: 3.05 }, { x: 6.4, z: 3.4 })),
  "plant-desks": standing("plant-desks", { x: 4.55, z: -3.9 }, facing.backWall),
  // From the open side by the meeting table, not the narrow lane to 2B's desk on the other side.
  "plant-center": standing("plant-center", { x: 1.45, z: -0.95 }, facing.camera),
  ...meetingStations(),
  // Players stand off each end of the table, facing each other across it.
  "pingpong-west": standing("pingpong-west", { x: 2.2, z: -1.2 }, facing.right),
  "pingpong-east": standing("pingpong-east", { x: 4.4, z: -1.2 }, facing.leftWall),
};

function meetingStations(): Record<MeetingStationId, Station> {
  return Object.fromEntries(
    meetingSeats.map((seat, index) => {
      const id = meetingIds[index] as MeetingStationId;
      const back = seat.z < -1.3;
      // End seats are entered from the outer end of the table; the middle ones from behind the
      // chair, since a neighbour sits on either side.
      const approach =
        seat.x === meetingTableX
          ? { x: seat.x, z: seat.z + (back ? -0.55 : 0.55) }
          : { x: seat.x + (seat.x < meetingTableX ? -chairSideStep : chairSideStep), z: seat.z };
      return [id, { id, spot: { x: seat.x, z: seat.z }, facing: seat.yaw, approach, seatHeight: chairSeatHeight }];
    }),
  ) as Record<MeetingStationId, Station>;
}

/** The meeting seats in order, for the props that belong to each one. */
export const meetingStationIds: readonly MeetingStationId[] = meetingIds;

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
