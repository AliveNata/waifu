/**
 * AlyxLabs floor plan as data. The scene builds furniture meshes from it, the
 * navigation grid treats furniture footprints as walls, and stations say where
 * a character stands or sits to use something. Keeping all three on one list
 * means a moved desk can never leave its chair or its walkway behind.
 *
 * World axes: x grows to the right, z grows toward the camera. The back wall
 * sits at z = minZ and the left wall at x = minX; the camera looks in from +x/+z.
 */

import { type MemberId, memberIds } from "../../shared/team.js";

export interface Point {
  x: number;
  z: number;
}

/**
 * Walls are 2.6 m: a loft feel over the people here, still short of a warehouse.
 * The room is laid out in zones that each read at a glance from the camera: the pantry and the
 * planning pod by the boards on the left, the builders' L-desks along the back wall mirrored
 * around the logo, 2B front and center between Erza and Miruku, the meeting table on the same
 * center line, a game and fitness corner at the back right, the way in by the door, Ruby's studio
 * at the front right, the lounge at the front left behind a long aquarium, and a collaboration
 * corner between the meeting table and the game corner.
 */
export const room = { minX: -7, maxX: 10.5, minZ: -5, maxZ: 4, wallHeight: 2.6 } as const;

/**
 * The whole office is scaled to its people: at ordinary proportions they stand 1.2 m with their
 * eyes near 1.12 m; seated, the eyes sit near 0.86 m and the hands reach up to about 1.15 m.
 * Work surfaces, screens and boards are placed against these numbers, so nobody types into a
 * counter at chin height or watches a screen above their head.
 */
export const people = { standing: 1.2, eye: 1.12, seatedEye: 0.86, reach: 1.15 } as const;

/** Heights of the surfaces people use, scaled from adult furniture by about 0.73. */
export const surface = { desk: 0.55, counter: 0.66, barTable: 0.72, pingpong: 0.56, coffeeTable: 0.33 } as const;

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
  | "desk-arisu"
  | "desk-komachi"
  | "desk-miruku"
  | "desk-huagua"
  | "desk-return"
  | "bookshelf"
  | "chair"
  | "server-rack"
  | "arcade"
  | "pantry-counter"
  | "fridge"
  | "bar-counter"
  | "stool"
  | "whiteboard"
  | "idea-board"
  | "board-step"
  | "wall-clock"
  | "trash-bin"
  | "entry-door"
  | "tv-wall"
  | "tv-console"
  | "sofa"
  | "coffee-table"
  | "beanbag"
  | "rug"
  | "plant"
  | "status-board"
  | "ring-light"
  | "camera-tripod"
  | "backdrop"
  | "meeting-table"
  | "pingpong-table"
  | "printer-cabinet"
  | "treadmill"
  | "punching-bag"
  | "aquarium"
  | "bench"
  | "high-table"
  | "glass-board";

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

/** Beside a teammate's desk, where 2B stands to hand over a brief. */
type VisitStationId = `visit-${Exclude<MemberId, "twob">}`;

export type StationId =
  | "desk-asuna"
  | "desk-kobayashi"
  | "desk-erza"
  | "desk-yor"
  | "desk-twob"
  | "desk-ruby"
  | "desk-rias"
  | "desk-chizuru"
  | "desk-arisu"
  | "desk-komachi"
  | "desk-miruku"
  | "desk-huagua"
  | "board-rias"
  | "board-twob"
  | "idea-board"
  | "front"
  | "coffee"
  | "fridge"
  | "sink"
  | "oven"
  | "bar-left"
  | "bar-right"
  | "bar-west-left"
  | "bar-west-right"
  | "bar-food"
  | "trash"
  | "door"
  | "sofa-1"
  | "sofa-2"
  | "sofa-3"
  | "beanbag-lounge"
  | "arcade"
  | "arcade-2"
  | "treadmill-1"
  | "treadmill-2"
  | "punching-bag"
  | "aquarium"
  | "collab-1"
  | "collab-2"
  | "collab-3"
  | StandupStationId
  | "rack"
  | "selfie"
  | "bookshelf"
  | "plant-lounge"
  | "plant-corner"
  | "plant-desks"
  | "meeting-1"
  | "meeting-2"
  | "meeting-3"
  | "meeting-4"
  | "meeting-5"
  | "meeting-6"
  | "meeting-7"
  | "meeting-8"
  | "meeting-9"
  | "meeting-10"
  | "meeting-11"
  | "meeting-12"
  | "pingpong-west"
  | "pingpong-east"
  | VisitStationId
  | "report-1"
  | "report-2"
  | "report-3";

/** Where people stand at the morning standup: 1 is the lead's spot by the glass board. */
export type StandupStationId =
  | "standup-1"
  | "standup-2"
  | "standup-3"
  | "standup-4"
  | "standup-5"
  | "standup-6"
  | "standup-7"
  | "standup-8"
  | "standup-9"
  | "standup-10"
  | "standup-11"
  | "standup-12";

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
/** Office chairs at knee height, so feet rest flat on the floor and thighs stay level. */
export const chairSeatHeight = 0.32;
// About 0.43 m in life, at the room's 0.73 scale.
const sofaSeatHeight = 0.31;
/**
 * The lane between the sofa and the coffee table. The sofa faces the TV with its back to the
 * room, so sitters walk in along this lane from the north end and sit down from the front.
 */
const sofaFrontX = -5.4;
/**
 * Bar and high-table stools: the counter tops (0.72 m) sit as far above the seat as a desk does
 * above its chair, so whoever sits there has the top at their elbows, not at their chest.
 */
const stoolSeatHeight = 0.5;
/** The cushion surface of the reshaped beanbag, so sitters rest on it instead of sinking in. */
const beanbagSeatHeight = 0.22;

/**
 * x of each back-row desk, left to right: the people who build. Two on each side of the logo with
 * the shared printer under it, so the wall reads as one symmetric run. Kobayashi sits nearest the
 * planning pod, Huagua next to him so design and code sit side by side, and Yor next to her
 * server rack.
 */
export const deskRowX = { kobayashi: -2.3, huagua: -0.6, asuna: 1.4, yor: 3.3 } as const;
const deskRowZ = -4.55;
const deskRowDepth = 0.8;
const deskRowWidth = 1.6;

/**
 * The short leg of an L-desk: a narrower surface joined to one end of the main desk, reaching out
 * on the sitter's side. It sits beside the chair, never behind it, so the chair still slides in.
 */
const returnWidth = 0.45;
const returnReach = 0.65;

function deskReturn(
  member: string,
  deskX: number,
  deskWidth: number,
  frontEdgeZ: number,
  side: -1 | 1,
  toward: -1 | 1,
): Furniture {
  return {
    id: `return-${member}`,
    kind: "desk-return",
    x: deskX + side * (deskWidth / 2 - returnWidth / 2),
    z: frontEdgeZ + (toward * returnReach) / 2,
    width: returnWidth,
    depth: returnReach,
    yaw: facing.camera,
    blocksWalking: true,
  };
}

/**
 * Back-row L-desks flush against the back wall, every return on the right so the row repeats one
 * shape. Sitters come in from the left of their chair.
 */
const deskRow: Furniture[] = (Object.entries(deskRowX) as [keyof typeof deskRowX, number][]).flatMap(([member, x]) => [
  {
    id: `desk-${member}`,
    kind: `desk-${member}`,
    x,
    z: deskRowZ,
    width: deskRowWidth,
    depth: deskRowDepth,
    yaw: facing.camera,
    blocksWalking: true,
  },
  deskReturn(member, x, deskRowWidth, deskRowZ + deskRowDepth / 2, 1, 1),
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

/**
 * The front row on the room's center line: 2B in the middle, Erza and Miruku either side, all
 * facing the camera. Everything passes 2B, and nothing leaves without review and a security
 * check. Erza's return points out to the left and the others' to the right, so the row frames 2B.
 */
const frontRowZ = 1.95;
const frontSeatZ = 1.4;
const frontDeskDepth = 0.7;
const frontDeskWidth = 1.6;
export const frontRow = {
  erza: { x: -2.0, returnSide: -1 },
  twob: { x: 0.4, returnSide: 1 },
  miruku: { x: 2.8, returnSide: 1 },
} as const;
type FrontMember = keyof typeof frontRow;
/** 2B's seat, which reporters face across her desk. */
const twobSeat = { x: frontRow.twob.x, z: frontSeatZ } as const;

const frontDesks: Furniture[] = (Object.entries(frontRow) as [FrontMember, (typeof frontRow)[FrontMember]][]).flatMap(
  ([member, { x, returnSide }]): Furniture[] => [
    {
      id: `desk-${member}`,
      kind: `desk-${member}`,
      x,
      z: frontRowZ,
      width: frontDeskWidth,
      depth: frontDeskDepth,
      yaw: facing.backWall,
      blocksWalking: true,
    },
    deskReturn(member, x, frontDeskWidth, frontRowZ - frontDeskDepth / 2, returnSide, -1),
    {
      id: `chair-${member}`,
      kind: "chair",
      x,
      z: frontSeatZ,
      width: 0.5,
      depth: 0.5,
      yaw: facing.camera,
      blocksWalking: true,
    },
  ],
);

/**
 * Two desks pushed together face to face. The north desk's sitter faces the room with the desk
 * between them and the camera, the south desk's sitter faces the back wall with the screen in view.
 */
interface Pod {
  centerZ: number;
  deskWidth: number;
  deskDepth: number;
}

/**
 * Planning, at the front right beside Miruku: Rias and Arisu on the north side facing the room,
 * Chizuru and Komachi across from them. Straight desks pushed together, not L-desks, so the four
 * talk across one table. The boards stay on the left wall, a walk away for drawing sessions.
 */
const planningPod: Pod = { centerZ: 1.9, deskWidth: 1.3, deskDepth: 0.65 };

type PodMember = "rias" | "chizuru" | "arisu" | "komachi";
type PodSide = "north" | "south";

export const podSeats: Record<PodMember, { x: number; side: PodSide; pod: Pod }> = {
  rias: { x: 4.85, side: "north", pod: planningPod },
  arisu: { x: 6.25, side: "north", pod: planningPod },
  chizuru: { x: 4.85, side: "south", pod: planningPod },
  komachi: { x: 6.25, side: "south", pod: planningPod },
};

/** From the desk's middle to the seat, as at 2B's desk. */
const podSeatGap = 0.55;
const podApproachClearance = 0.08;

function podDeskZ(pod: Pod, side: PodSide): number {
  return pod.centerZ + ((side === "north" ? -1 : 1) * pod.deskDepth) / 2;
}

function podSeatZ(pod: Pod, side: PodSide): number {
  return podDeskZ(pod, side) + (side === "north" ? -podSeatGap : podSeatGap);
}

const pods: Furniture[] = (Object.entries(podSeats) as [PodMember, (typeof podSeats)[PodMember]][]).flatMap(
  ([member, { x, side, pod }]): Furniture[] => [
    {
      id: `desk-${member}`,
      kind: `desk-${member}`,
      x,
      z: podDeskZ(pod, side),
      width: pod.deskWidth,
      depth: pod.deskDepth,
      yaw: side === "north" ? facing.backWall : facing.camera,
      blocksWalking: true,
    },
    {
      id: `chair-${member}`,
      kind: "chair",
      x,
      z: podSeatZ(pod, side),
      width: 0.5,
      depth: 0.5,
      yaw: side === "north" ? facing.camera : facing.backWall,
      blocksWalking: true,
    },
  ],
);

/**
 * Ruby's studio at the front right, facing the camera like a set: the backdrop behind her chair,
 * the ring light at her front left and the camera on its tripod in front. Both aim at her seat.
 */
const rubySeat = { x: 8.5, z: 1.75 } as const;
const rubyDeskZ = rubySeat.z + 0.55;
const rubyDeskWidth = 1.3;
const rubyDeskDepth = 0.65;
const ringLightSpot = { x: 7.4, z: 2.25 } as const;
const tripodSpot = { x: 9.4, z: 3.1 } as const;
/** Off the backdrop's west end, facing the camera on its tripod. */
const selfieSpot = { x: 7.4, z: 1.45 } as const;

/**
 * The game and fitness corner at the back right, on a rubber mat: two arcade cabinets under the
 * status board, two treadmills facing the window, the ping-pong table in front and a punching bag
 * by the lobby.
 */
const arcadeX = [5.8, 6.8] as const;
const arcadeZ = -4.55;
const treadmillX = [8.35, 9.35] as const;
const treadmillZ = -4.35;
const treadmillLength = 1.2;
/** The belt deck's top: a runner stands this high while on it. */
export const treadmillDeckHeight = 0.12;
const pingpongCenter = { x: 7.1, z: -2.75 } as const;
const punchingBagSpot = { x: 9.9, z: -2.75 } as const;
/** A long low aquarium between the front row and the lounge. */
const aquariumSpot = { x: -1.9, z: 3.6 } as const;
/** The bookshelf's middle, its back to the front wall, and how wide it runs along it. */
const bookshelfSpot = { x: 0.65, z: 3.79 } as const;
const bookshelfWidth = 1.5;

/**
 * The collaboration corner between the meeting table and the game corner: a round standing-height
 * table with three stools around it and a glass board behind, for a quick talk that does not need
 * the meeting table.
 */
const collabCenter = { x: 4.2, z: -1.3 } as const;

/**
 * The standup circle around the high table, everyone facing the glass board: the lead stands at
 * the board's right edge facing the group, the rest on an arc on the open sides of the table, a
 * body's width apart and clear of the stools.
 */
const standupRadius = 1.15;
const standupArc = { from: -0.26, to: Math.PI + 0.26 } as const;
const standupLeadSpot = { x: collabCenter.x + 0.78, z: collabCenter.z - 0.9 } as const;

export const standupStationIds: readonly StandupStationId[] = Array.from(
  { length: 12 },
  (_, index) => `standup-${index + 1}` as StandupStationId,
);

/** From the table's middle to each stool: close enough to lean on the table, clear of its edge. */
/** Close enough to the high table's 0.35 m top that knees go under it and hands reach it. */
const collabStoolRadius = 0.55;
/** Stools at the south, then back left and back right, evenly round the table. */
const collabStools = [Math.PI / 2, (7 * Math.PI) / 6, (11 * Math.PI) / 6].map((angle) => ({
  x: collabCenter.x + collabStoolRadius * Math.cos(angle),
  z: collabCenter.z + collabStoolRadius * Math.sin(angle),
}));

const meetingIds = [
  "meeting-1",
  "meeting-2",
  "meeting-3",
  "meeting-4",
  "meeting-5",
  "meeting-6",
  "meeting-7",
  "meeting-8",
  "meeting-9",
  "meeting-10",
  "meeting-11",
  "meeting-12",
] as const;
export type MeetingStationId = (typeof meetingIds)[number];

/**
 * The meeting table, on the room's center line under the logo and in line with 2B's desk, with
 * twelve chairs so the whole team fits: five along each side and one at each end.
 */
const meetingTable = { x: 0.4, z: -1.3, width: 3.25, depth: 0.9 } as const;
/** Chairs along each side, as close together as elbows allow. */
const meetingSeatGap = 0.65;
const meetingSideXs = [-2, -1, 0, 1, 2].map((step) => meetingTable.x + step * meetingSeatGap);
/** From the table's edge to a chair's middle. */
const meetingChairReach = 0.3;
const meetingSeats = [
  ...meetingSideXs.map((x) => ({
    x,
    z: meetingTable.z - meetingTable.depth / 2 - meetingChairReach,
    yaw: facing.camera,
    end: false,
  })),
  ...meetingSideXs.map((x) => ({
    x,
    z: meetingTable.z + meetingTable.depth / 2 + meetingChairReach,
    yaw: facing.backWall,
    end: false,
  })),
  { x: meetingTable.x - meetingTable.width / 2 - 0.35, z: meetingTable.z, yaw: facing.right, end: true },
  { x: meetingTable.x + meetingTable.width / 2 + 0.35, z: meetingTable.z, yaw: facing.leftWall, end: true },
];

/**
 * Where each seat's laptop goes on the table, in the table's own frame. A laptop's keys face +z in
 * its own frame, so each is turned to face the chair it belongs to.
 */
export const meetingLaptopSpots: readonly { x: number; z: number; yaw: number }[] = meetingSeats.map((seat) => {
  if (seat.end) {
    const east = seat.x > meetingTable.x;
    return { x: (east ? 1 : -1) * (meetingTable.width / 2 - 0.17), z: 0, yaw: east ? Math.PI / 2 : -Math.PI / 2 };
  }
  const back = seat.z < meetingTable.z;
  return { x: seat.x - meetingTable.x, z: back ? -0.22 : 0.22, yaw: back ? Math.PI : 0 };
});

/**
 * The pantry is an L: the counter along the back wall, and at its east end a raised bar running
 * out into the room with two stools on each side.
 */
const barCounter = { x: -3.86, z: -3.86, width: 0.48, depth: 2.22 } as const;
/** Pulled in to the counter's edge, so the sitter's hands are on the top, not out over the floor. */
const barStoolX = -3.4;
const barStools = [
  // Turned a little toward each other, so the two can talk without twisting round.
  { id: "stool-left", z: -3.5, yaw: facing.leftWall + 0.4 },
  { id: "stool-right", z: -2.95, yaw: facing.leftWall - 0.4 },
] as const;
/** The pantry side of the bar, mirrored, kept clear of whoever stands at the oven. */
const westStoolX = barCounter.x - (barStoolX - barCounter.x);
const westStools = [
  { id: "stool-west-left", z: -3.2, yaw: facing.right - 0.4 },
  { id: "stool-west-right", z: -2.8, yaw: facing.right + 0.4 },
] as const;
/** Shared food sits on the bar's south end; people take it standing at the tip. */
export const barFoodSpot = { x: barCounter.x, z: barCounter.z + barCounter.depth / 2 - 0.16 } as const;
/** Where the sink and oven sit along the pantry counter; the coffee machine is between them. */
const sinkX = -5.85;
const ovenX = -4.55;

export const furniture: readonly Furniture[] = [
  ...deskRow,
  ...pods,
  ...frontDesks,
  {
    id: "desk-ruby",
    kind: "desk-ruby",
    x: rubySeat.x,
    z: rubyDeskZ,
    width: rubyDeskWidth,
    depth: rubyDeskDepth,
    yaw: facing.backWall,
    blocksWalking: true,
  },
  {
    id: "chair-ruby",
    kind: "chair",
    x: rubySeat.x,
    z: rubySeat.z,
    width: 0.5,
    depth: 0.5,
    yaw: facing.camera,
    blocksWalking: true,
  },
  {
    id: "backdrop",
    kind: "backdrop",
    x: rubySeat.x,
    z: 1.22,
    width: 1.5,
    depth: 0.12,
    yaw: facing.camera,
    blocksWalking: true,
  },
  {
    id: "ring-light",
    kind: "ring-light",
    ...ringLightSpot,
    width: 0.35,
    depth: 0.35,
    // Lights Ruby's face at her desk, from her front left, like a key light.
    yaw: yawToward(ringLightSpot, rubySeat),
    blocksWalking: true,
  },
  {
    id: "camera-tripod",
    kind: "camera-tripod",
    ...tripodSpot,
    width: 0.4,
    depth: 0.4,
    // The lens points at Ruby in her chair, the same subject the ring light is lighting.
    yaw: yawToward(tripodSpot, rubySeat),
    blocksWalking: true,
  },
  // Who is working on what, on the back wall above the arcades, where everyone in the room can see
  // it. Wall-mounted, so it blocks nothing on the floor.
  {
    id: "status-board",
    kind: "status-board",
    x: 6.3,
    z: -4.96,
    width: 2.3,
    depth: 0.04,
    yaw: facing.camera,
    blocksWalking: false,
  },
  // The end of the build row, next to Yor.
  {
    id: "server-rack",
    kind: "server-rack",
    x: 4.55,
    z: -4.6,
    width: 0.7,
    depth: 0.7,
    yaw: facing.camera,
    blocksWalking: true,
  },
  // A rubber mat marks the game and fitness corner off from the office floor.
  { id: "rug-game", kind: "rug", x: 7.85, z: -3.45, width: 5.1, depth: 3.0, yaw: facing.camera, blocksWalking: false },
  ...arcadeX.map(
    (x, index): Furniture => ({
      id: index === 0 ? "arcade" : `arcade-${index + 1}`,
      kind: "arcade",
      x,
      z: arcadeZ,
      width: 0.8,
      depth: 0.8,
      yaw: facing.camera,
      blocksWalking: true,
    }),
  ),
  ...treadmillX.map(
    (x, index): Furniture => ({
      id: `treadmill-${index + 1}`,
      kind: "treadmill",
      x,
      z: treadmillZ,
      width: 0.55,
      depth: treadmillLength,
      // Runners face the window over the back wall.
      yaw: facing.backWall,
      blocksWalking: true,
    }),
  ),
  {
    id: "pingpong-table",
    kind: "pingpong-table",
    ...pingpongCenter,
    // A full table at the room's 0.73 scale (2.74 by 1.525 m real).
    width: 2.0,
    depth: 1.1,
    yaw: facing.camera,
    blocksWalking: true,
  },
  {
    id: "punching-bag",
    kind: "punching-bag",
    ...punchingBagSpot,
    width: 0.5,
    depth: 0.5,
    yaw: facing.camera,
    blocksWalking: true,
  },
  // A bench along the mat's front edge, facing the ping-pong table, for whoever is watching a game.
  {
    id: "bench-game",
    kind: "bench",
    x: pingpongCenter.x,
    z: -1.6,
    width: 1.3,
    depth: 0.42,
    yaw: facing.backWall,
    blocksWalking: true,
  },
  {
    id: "aquarium",
    kind: "aquarium",
    ...aquariumSpot,
    width: 2.0,
    depth: 0.5,
    yaw: facing.camera,
    blocksWalking: true,
  },
  // A light rug marks the collaboration corner off from the walkway around it.
  {
    id: "rug-collab",
    kind: "rug",
    x: collabCenter.x,
    z: collabCenter.z - 0.15,
    width: 2.1,
    depth: 2.4,
    yaw: facing.camera,
    blocksWalking: false,
  },
  {
    id: "high-table",
    kind: "high-table",
    ...collabCenter,
    width: 0.56,
    depth: 0.56,
    yaw: facing.camera,
    blocksWalking: true,
  },
  ...collabStools.map(
    (stool, index): Furniture => ({
      id: `stool-collab-${index + 1}`,
      kind: "stool",
      ...stool,
      width: 0.36,
      depth: 0.36,
      yaw: yawToward(stool, collabCenter),
      blocksWalking: true,
    }),
  ),
  // Behind the table, facing the camera, so whoever sits there can point at it.
  {
    id: "glass-board",
    kind: "glass-board",
    x: collabCenter.x,
    z: collabCenter.z - 1.2,
    width: 1.1,
    depth: 0.08,
    yaw: facing.camera,
    blocksWalking: true,
  },
  // A pair of plants against the front wall, either side of the bookshelf between them.
  ...[bookshelfSpot.x - bookshelfWidth / 2 - 0.3, bookshelfSpot.x + bookshelfWidth / 2 + 0.3].map(
    (x, index): Furniture => ({
      id: `plant-front-${index + 1}`,
      kind: "plant",
      x,
      z: 3.72,
      width: 0.4,
      depth: 0.4,
      yaw: facing.camera,
      blocksWalking: true,
    }),
  ),

  // Chest-high shelves of books against the front wall, the spines facing into the room.
  {
    id: "bookshelf",
    kind: "bookshelf",
    ...bookshelfSpot,
    width: bookshelfWidth,
    depth: 0.34,
    yaw: facing.backWall,
    blocksWalking: true,
  },

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
  ...[
    ...barStools.map((stool) => ({ ...stool, x: barStoolX })),
    ...westStools.map((stool) => ({ ...stool, x: westStoolX })),
  ].map(
    (stool): Furniture => ({
      id: stool.id,
      kind: "stool",
      x: stool.x,
      z: stool.z,
      width: 0.36,
      depth: 0.36,
      yaw: stool.yaw,
      blocksWalking: true,
    }),
  ),
  // Where the empty food box goes: against the wall between the spot in front of the fridge and
  // the board step, out of the way of anyone walking through the pantry.
  {
    id: "trash-bin",
    kind: "trash-bin",
    x: -6.8,
    z: -3.36,
    width: 0.3,
    depth: 0.3,
    yaw: facing.right,
    blocksWalking: true,
  },
  // The way in and out, at the open right-hand side of the room: whoever buys food leaves here.
  // Twice as wide as the opening, since each glass door slides out to one side.
  {
    id: "entry-door",
    kind: "entry-door",
    x: 10.42,
    z: -0.45,
    width: 0.12,
    depth: 1.8,
    yaw: facing.leftWall,
    blocksWalking: true,
  },

  {
    id: "whiteboard",
    kind: "whiteboard",
    x: -6.95,
    z: -2.0,
    width: 0.1,
    // 2.2 x 0.85 m, bottom edge 0.45 m up: a normal board's proportions. The writing stays in
    // the part a person reaches from the low step in front.
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
  // A low step along each board, so the top of the writing is in reach. Walked onto, not around.
  {
    id: "step-whiteboard",
    kind: "board-step",
    x: -6.7,
    z: -2.0,
    width: 0.6,
    depth: 2.4,
    yaw: facing.right,
    blocksWalking: false,
  },
  {
    id: "step-idea-board",
    kind: "board-step",
    x: -6.7,
    z: 0.55,
    width: 0.6,
    depth: 1.5,
    yaw: facing.right,
    blocksWalking: false,
  },
  // A big digital clock on the pantry wall, above the open shelf.
  {
    id: "wall-clock",
    kind: "wall-clock",
    x: -5.15,
    z: -4.96,
    width: 1.15,
    depth: 0.04,
    yaw: facing.camera,
    blocksWalking: false,
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
    // Behind the sofa's open side, at the aquarium's end: the left-wall corner is boxed in by the
    // beanbag and the coffee table, so a plant there could never be reached for watering.
    x: -3.6,
    z: 3.65,
    width: 0.5,
    depth: 0.5,
    yaw: facing.camera,
    blocksWalking: true,
  },
  {
    id: "plant-corner",
    kind: "plant",
    // In the lobby, beside the way in.
    x: 9.95,
    z: 0.8,
    width: 0.6,
    depth: 0.6,
    yaw: facing.camera,
    blocksWalking: true,
  },
  {
    id: "plant-desks",
    kind: "plant",
    // Between the rack and the arcades, where the build row meets the game corner.
    x: 5.12,
    z: -4.65,
    width: 0.4,
    depth: 0.4,
    yaw: facing.camera,
    blocksWalking: true,
  },
  // Center of the room: a team table for standups and laptop work.
  {
    id: "meeting-table",
    kind: "meeting-table",
    x: meetingTable.x,
    z: meetingTable.z,
    width: meetingTable.width,
    depth: meetingTable.depth,
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
  // The shared printer, under the logo between Huagua and Asuna.
  {
    id: "printer-back",
    kind: "printer-cabinet",
    x: 0.4,
    z: -4.6,
    width: 0.36,
    depth: 0.6,
    yaw: facing.camera,
    blocksWalking: true,
  },
];

/**
 * Chairs are entered from the side, the way people pull up to a desk: coming in from behind
 * would walk the sitter straight through the backrest.
 */
const chairSideStep = 0.55;

/** Back-row seats are entered from the left: the desk's return is on the right. */
function deskRowStation(id: StationId, x: number): Station {
  return {
    id,
    spot: { x, z: deskRowSeatZ },
    facing: facing.backWall,
    approach: { x: x - chairSideStep, z: deskRowSeatZ },
    seatHeight: chairSeatHeight,
  };
}

/** Front-row seats are entered from the side away from the desk's return. */
function frontRowStation(id: StationId, member: FrontMember): Station {
  const { x, returnSide } = frontRow[member];
  return {
    id,
    spot: { x, z: frontSeatZ },
    facing: facing.camera,
    approach: { x: x - returnSide * chairSideStep, z: frontSeatZ },
    seatHeight: chairSeatHeight,
  };
}

/** A pod seat: the north side faces the room, the south side faces the back wall. */
function podStation(id: StationId, member: PodMember): Station {
  const { x, side, pod } = podSeats[member];
  const z = podSeatZ(pod, side);
  // Stepping in from a little further out than the seat: the pod desks are shallow, and right
  // beside the seat the walkable floor is too close to the desk edge to count as clear.
  const awayFromDesk = side === "north" ? -podApproachClearance : podApproachClearance;
  return {
    id,
    spot: { x, z },
    facing: side === "north" ? facing.camera : facing.backWall,
    approach: { x: x + chairSideStep, z: z + awayFromDesk },
    seatHeight: chairSeatHeight,
  };
}

function standing(id: StationId, spot: Point, yaw: number, approach: Point = spot): Station {
  return { id, spot, facing: yaw, approach, seatHeight: null };
}

/** How high the board steps are. */
export const boardStepHeight = 0.18;

/** Height of the floor under `point`: the top of a board step or treadmill belt there, else the floor itself. */
export function floorHeightAt(point: Point): number {
  for (const piece of furniture) {
    if (
      piece.kind === "treadmill" &&
      Math.abs(point.x - piece.x) <= piece.width / 2 &&
      Math.abs(point.z - piece.z) <= piece.depth / 2
    ) {
      return treadmillDeckHeight;
    }
    if (
      piece.kind === "board-step" &&
      Math.abs(point.x - piece.x) <= piece.width / 2 &&
      Math.abs(point.z - piece.z) <= piece.depth / 2
    ) {
      return boardStepHeight;
    }
  }
  return 0;
}

/** Yaw that turns someone at `from` toward `to`. */
export function yawToward(from: Point, to: Point): number {
  return Math.atan2(to.x - from.x, to.z - from.z);
}

/** Close enough to the boards (surface at x -6.91) that an arm reaches the writing. */
const boardStandX = -6.68;

const placeStations: Record<Exclude<StationId, VisitStationId>, Station> = {
  "desk-asuna": deskRowStation("desk-asuna", deskRowX.asuna),
  "desk-kobayashi": deskRowStation("desk-kobayashi", deskRowX.kobayashi),
  "desk-huagua": deskRowStation("desk-huagua", deskRowX.huagua),
  "desk-yor": deskRowStation("desk-yor", deskRowX.yor),
  "desk-ruby": {
    id: "desk-ruby",
    spot: rubySeat,
    facing: facing.camera,
    // From the left, the side away from the camera tripod, and a little back from the desk: her
    // desk is as shallow as the pod desks, so right beside the seat is too close to its edge.
    approach: { x: rubySeat.x - chairSideStep, z: rubySeat.z - podApproachClearance },
    seatHeight: chairSeatHeight,
  },
  "desk-twob": frontRowStation("desk-twob", "twob"),
  "desk-rias": podStation("desk-rias", "rias"),
  "desk-chizuru": podStation("desk-chizuru", "chizuru"),
  "desk-arisu": podStation("desk-arisu", "arisu"),
  "desk-komachi": podStation("desk-komachi", "komachi"),
  "desk-erza": frontRowStation("desk-erza", "erza"),
  "desk-miruku": frontRowStation("desk-miruku", "miruku"),
  // Facing the left wall, the board's left half (+z side) is 2B's plan and the right half Rias's sketches.
  "board-twob": standing("board-twob", { x: boardStandX, z: -1.4 }, facing.leftWall),
  "board-rias": standing("board-rias", { x: boardStandX, z: -2.65 }, facing.leftWall),
  "idea-board": standing("idea-board", { x: boardStandX, z: 0.4 }, facing.leftWall),
  front: standing("front", { x: 0.4, z: 3.0 }, facingCamera),
  // In front of 2B's desk for a report: the first spot hands it over across the desk, the other
  // two wait their turn either side, clear of the plants.
  "report-1": standing("report-1", { x: twobSeat.x, z: 2.62 }, facing.backWall),
  "report-2": standing(
    "report-2",
    { x: twobSeat.x + 0.65, z: 2.78 },
    yawToward({ x: twobSeat.x + 0.65, z: 2.78 }, twobSeat),
  ),
  "report-3": standing(
    "report-3",
    { x: twobSeat.x - 0.65, z: 2.78 },
    yawToward({ x: twobSeat.x - 0.65, z: 2.78 }, twobSeat),
  ),
  // Right up at the counter edge: the team is 1.2 m tall, and the machine is an arm away.
  coffee: standing("coffee", { x: -5.35, z: -4.1 }, facing.backWall),
  // An arm's length from the shelves inside; the door swings open on the other side.
  fridge: standing("fridge", { x: -6.55, z: -4.0 }, facing.backWall),
  sink: standing("sink", { x: sinkX, z: -4.1 }, facing.backWall),
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
  "bar-west-left": {
    id: "bar-west-left",
    spot: { x: westStoolX, z: westStools[0].z },
    facing: westStools[0].yaw,
    approach: { x: westStoolX - 0.5, z: westStools[0].z },
    seatHeight: stoolSeatHeight,
  },
  "bar-west-right": {
    id: "bar-west-right",
    spot: { x: westStoolX, z: westStools[1].z },
    facing: westStools[1].yaw,
    approach: { x: westStoolX - 0.5, z: westStools[1].z },
    seatHeight: stoolSeatHeight,
  },
  // Close up to the bar's end, where the food box is within an arm's reach.
  "bar-food": standing("bar-food", { x: barCounter.x, z: barCounter.z + barCounter.depth / 2 + 0.22 }, facing.backWall),
  trash: standing("trash", { x: -6.36, z: -3.36 }, facing.leftWall),
  door: standing("door", { x: 10.0, z: -0.45 }, facing.right),
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
  arcade: standing("arcade", { x: arcadeX[0], z: -3.8 }, facing.backWall),
  "arcade-2": standing("arcade-2", { x: arcadeX[1], z: -3.8 }, facing.backWall),
  // On the belt, stepped onto from behind like a real treadmill.
  "treadmill-1": standing("treadmill-1", { x: treadmillX[0], z: treadmillZ + 0.05 }, facing.backWall, {
    x: treadmillX[0],
    z: treadmillZ + treadmillLength / 2 + 0.25,
  }),
  "treadmill-2": standing("treadmill-2", { x: treadmillX[1], z: treadmillZ + 0.05 }, facing.backWall, {
    x: treadmillX[1],
    z: treadmillZ + treadmillLength / 2 + 0.25,
  }),
  // A short step back from the bag: a jab reaches about a third of a meter.
  "punching-bag": standing("punching-bag", { x: punchingBagSpot.x, z: punchingBagSpot.z + 0.55 }, facing.backWall),
  aquarium: standing("aquarium", { x: aquariumSpot.x, z: aquariumSpot.z - 0.55 }, facing.camera),
  ...collabStations(),
  ...standupStations(),
  rack: standing("rack", { x: 4.55, z: -3.85 }, facing.backWall),
  // In front of her backdrop, so the ring light and camera frame her like a real shoot.
  selfie: standing("selfie", selfieSpot, yawToward(selfieSpot, tripodSpot)),
  // In front of the shelves, facing them, an arm's length off.
  bookshelf: standing("bookshelf", { x: bookshelfSpot.x, z: bookshelfSpot.z - 0.62 }, facing.camera),
  "plant-lounge": standing("plant-lounge", { x: -3.6, z: 3.05 }, facing.camera),
  "plant-corner": standing("plant-corner", { x: 9.4, z: 0.8 }, facing.right),
  "plant-desks": standing("plant-desks", { x: 5.12, z: -3.9 }, facing.backWall),
  // From the open side by the meeting table, not the narrow lane to 2B's desk on the other side.
  ...meetingStations(),
  // Players stand off each end of the table, facing each other across it.
  "pingpong-west": standing("pingpong-west", { x: pingpongCenter.x - 1.35, z: pingpongCenter.z }, facing.right),
  "pingpong-east": standing("pingpong-east", { x: pingpongCenter.x + 1.35, z: pingpongCenter.z }, facing.leftWall),
};

/**
 * Where 2B stands to hand a teammate a brief: the spot where they step to their chair, turned
 * toward the seat, so she is right beside them without walking into the desk.
 */
function visitStations(desks: typeof placeStations): Record<VisitStationId, Station> {
  return Object.fromEntries(
    memberIds
      .filter((memberId): memberId is Exclude<MemberId, "twob"> => memberId !== "twob")
      .map((memberId) => {
        const id: VisitStationId = `visit-${memberId}`;
        const desk = desks[`desk-${memberId}`];
        return [id, standing(id, desk.approach, yawToward(desk.approach, desk.spot))];
      }),
  ) as Record<VisitStationId, Station>;
}

export const stations: Record<StationId, Station> = { ...placeStations, ...visitStations(placeStations) };

function meetingStations(): Record<MeetingStationId, Station> {
  return Object.fromEntries(
    meetingSeats.map((seat, index) => {
      const id = meetingIds[index] as MeetingStationId;
      const back = seat.z < meetingTable.z;
      // Head seats are entered from beyond the end of the table; the side ones from behind the
      // chair, since a neighbour sits on either side.
      const approach = seat.end
        ? { x: seat.x + (seat.x < meetingTable.x ? -chairSideStep : chairSideStep), z: seat.z }
        : { x: seat.x, z: seat.z + (back ? -0.55 : 0.55) };
      return [id, { id, spot: { x: seat.x, z: seat.z }, facing: seat.yaw, approach, seatHeight: chairSeatHeight }];
    }),
  ) as Record<MeetingStationId, Station>;
}

/** The arcade cabinets' stations, in floor-plan order, for the screen that belongs to each. */
export const arcadeStationIds = ["arcade", "arcade-2"] as const satisfies readonly StationId[];
/** The treadmills' stations, in floor-plan order, for the belt that belongs to each. */
export const treadmillStationIds = ["treadmill-1", "treadmill-2"] as const satisfies readonly StationId[];

function collabStations(): Record<"collab-1" | "collab-2" | "collab-3", Station> {
  const ids = ["collab-1", "collab-2", "collab-3"] as const;
  return Object.fromEntries(
    collabStools.map((stool, index) => {
      const id = ids[index] as (typeof ids)[number];
      const facingTable = yawToward(stool, collabCenter);
      // Stepped onto from straight behind the stool, away from the table.
      const away = { x: stool.x - collabCenter.x, z: stool.z - collabCenter.z };
      const length = Math.hypot(away.x, away.z);
      const approach = { x: stool.x + (away.x / length) * 0.5, z: stool.z + (away.z / length) * 0.5 };
      return [id, { id, spot: stool, facing: facingTable, approach, seatHeight: stoolSeatHeight }];
    }),
  ) as Record<(typeof ids)[number], Station>;
}

function standupStations(): Record<StandupStationId, Station> {
  const center = { x: collabCenter.x, z: collabCenter.z - 0.15 };
  const board = { x: collabCenter.x, z: collabCenter.z - 1.0 };
  const ring = standupStationIds.length - 1;
  return Object.fromEntries(
    standupStationIds.map((id, index) => {
      if (index === 0) {
        return [id, standing(id, standupLeadSpot, yawToward(standupLeadSpot, center))];
      }
      const angle = standupArc.from + ((index - 1) / (ring - 1)) * (standupArc.to - standupArc.from);
      const spot = { x: center.x + standupRadius * Math.cos(angle), z: center.z + standupRadius * Math.sin(angle) };
      return [id, standing(id, spot, yawToward(spot, board))];
    }),
  ) as Record<StandupStationId, Station>;
}

/** The meeting seats in order, for the props that belong to each one. */
export const meetingStationIds: readonly MeetingStationId[] = meetingIds;

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/** How thick the walls are that close the room for Alyx, and the hall's walls with them. */
export const enclosureWall = 0.12;

/**
 * The hall behind the glass door: as wide as the door's footprint plus a margin, and at its far
 * end a turn to the north, out of sight from the room, where whoever leaves walks off.
 */
export const entryHall = ((): {
  from: number;
  to: number;
  z: number;
  width: number;
  turn: { from: number; to: number; zFrom: number; zTo: number };
} => {
  const door = furniture.find((piece) => piece.id === "entry-door");
  const doorFrom = door === undefined ? -0.9 : door.z - door.depth / 2;
  const doorTo = door === undefined ? 0.9 : door.z + door.depth / 2;
  const from = room.maxX + enclosureWall;
  const to = from + 1.8;
  const width = doorTo - doorFrom + 0.4;
  const z = (doorFrom + doorTo) / 2;
  const turnWidth = 0.9;
  const north = z + width / 2;
  return { from, to, z, width, turn: { from: to - turnWidth, to, zFrom: north, zTo: north + 1.4 } };
})();

/**
 * The walk out of the office, from the door spot: through the door to the end of the hall, then
 * north round the turn. Walked back the other way on the return.
 */
export const doorwayPath: readonly Point[] = [
  { x: 10.0, z: -0.45 },
  { x: (entryHall.turn.from + entryHall.turn.to) / 2, z: entryHall.z },
  { x: (entryHall.turn.from + entryHall.turn.to) / 2, z: entryHall.turn.zTo - 0.35 },
];
