/**
 * The team's wall magazine on the cork board: photos of the team on outings and lunches, small
 * notes, a fun fact and stickers. Busy on purpose, but every piece stays big enough to read from
 * a few steps away. Drawn once, then again when the members' photos come in.
 */

/** A member's face for the polaroids: their name and a square head shot, or null until it exists. */
export interface MadingPhoto {
  name: string;
  photo: CanvasImageSource | null;
}

/** What is behind the faces in a polaroid, matching where the photo was taken. */
export type PolaroidScene = "hills" | "lunch" | "hackathon" | "cafe" | "party";

/** The polaroids: who is in each, where it was taken, and the caption written under it. */
export const polaroids: readonly { caption: string; scene: PolaroidScene; members: readonly number[] }[] = [
  { caption: "Outing ke Puncak", scene: "hills", members: [0, 1, 2] },
  { caption: "Makan siang tim", scene: "lunch", members: [3, 4] },
  { caption: "Hackathon 24 jam", scene: "hackathon", members: [5, 6, 7] },
  { caption: "Rapat sambil ngopi", scene: "cafe", members: [8, 9] },
  { caption: "Ultah kantor", scene: "party", members: [10, 11] },
];

/** Little notes pinned between the photos. */
export const madingNotes: readonly { text: string; color: string }[] = [
  { text: "Standup 09.30, jangan telat!", color: "#f7e27a" },
  { text: "Deploy hari Jumat? Jangan.", color: "#f5a8c2" },
  { text: "Mochi jangan dikasih pizza", color: "#9fe0c0" },
  { text: "Kulkas dibersihin tiap Senin", color: "#a9cdf5" },
];

const handwriting = "'Segoe Print', 'Comic Sans MS', cursive";
const sans = "'Segoe UI', system-ui, sans-serif";

/** A strip of washi tape across a corner, half see-through like the real thing. */
function tape(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, color: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = color;
  ctx.fillRect(-46, -12, 92, 24);
  ctx.restore();
}

/** A round push pin with a highlight. */
function pin(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
  ctx.beginPath();
  ctx.arc(x + 3, y + 4, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
  ctx.beginPath();
  ctx.arc(x - 3, y - 3, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A five-pointed star sticker. */
function star(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let point = 0; point < 10; point++) {
    const radius = point % 2 === 0 ? size : size * 0.45;
    const angle = (point * Math.PI) / 5 - Math.PI / 2;
    ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Text broken onto lines that fit `width`, drawn from `y` down. */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  line: number,
): void {
  let current = "";
  let row = 0;
  for (const word of text.split(" ")) {
    const next = current === "" ? word : `${current} ${word}`;
    if (ctx.measureText(next).width > width && current !== "") {
      ctx.fillText(current, x, y + row * line);
      current = word;
      row++;
    } else {
      current = next;
    }
  }
  ctx.fillText(current, x, y + row * line);
}

/** The largest size up to `size` at which `text` fits in `width`, set as the context's font. */
function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  weight: number,
  size: number,
  family: string,
  width: number,
): void {
  let current = size;
  ctx.font = `${weight} ${current}px ${family}`;
  while (current > 12 && ctx.measureText(text).width > width) {
    current -= 1;
    ctx.font = `${weight} ${current}px ${family}`;
  }
}

type Picture = { x: number; y: number; w: number; h: number };

function gradient(ctx: CanvasRenderingContext2D, picture: Picture, stops: readonly [number, string][]): CanvasGradient {
  const fill = ctx.createLinearGradient(0, picture.y, 0, picture.y + picture.h);
  for (const [at, color] of stops) {
    fill.addColorStop(at, color);
  }
  return fill;
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Behind the faces, the place each snap was taken. The faces cover the lower part, so what tells
 * the place apart sits along the top and the sides.
 */
const backdrops: Record<PolaroidScene, (ctx: CanvasRenderingContext2D, picture: Picture) => void> = {
  // Puncak: a morning sky, layered green hills, tea rows and a few pines.
  hills(ctx, p) {
    ctx.fillStyle = gradient(ctx, p, [
      [0, "#8ec9f0"],
      [0.55, "#d8eef5"],
      [1, "#d8eef5"],
    ]);
    ctx.fillRect(p.x, p.y, p.w, p.h);
    circle(ctx, p.x + p.w - 46, p.y + 34, 16, "#fff1b8");
    const hill = (base: number, peaks: readonly [number, number][], color: string): void => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y + p.h);
      ctx.lineTo(p.x, p.y + base);
      for (const [u, height] of peaks) {
        ctx.quadraticCurveTo(p.x + p.w * (u - 0.12), p.y + base - height, p.x + p.w * u, p.y + base - height * 0.4);
      }
      ctx.lineTo(p.x + p.w, p.y + p.h);
      ctx.closePath();
      ctx.fill();
    };
    hill(
      96,
      [
        [0.3, 50],
        [0.65, 70],
        [1.05, 40],
      ],
      "#7aa7b8",
    );
    hill(
      118,
      [
        [0.25, 40],
        [0.55, 30],
        [0.9, 50],
        [1.1, 20],
      ],
      "#6fae6a",
    );
    hill(
      142,
      [
        [0.35, 30],
        [0.75, 26],
        [1.1, 30],
      ],
      "#4f9450",
    );
    ctx.strokeStyle = "rgba(40, 90, 40, 0.5)";
    ctx.lineWidth = 2;
    for (let row = 0; row < 4; row++) {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y + 150 + row * 10);
      ctx.quadraticCurveTo(p.x + p.w / 2, p.y + 140 + row * 10, p.x + p.w, p.y + 152 + row * 10);
      ctx.stroke();
    }
    for (const [u, size] of [
      [0.06, 26],
      [0.12, 20],
      [0.9, 28],
      [0.96, 22],
    ] as const) {
      ctx.fillStyle = "#2f6b3a";
      ctx.beginPath();
      ctx.moveTo(p.x + p.w * u, p.y + 118 - size);
      ctx.lineTo(p.x + p.w * u - size * 0.35, p.y + 120);
      ctx.lineTo(p.x + p.w * u + size * 0.35, p.y + 120);
      ctx.fill();
    }
  },
  // Lunch out: a warm restaurant wall, a window, pendant lamps and the table with the plates.
  lunch(ctx, p) {
    ctx.fillStyle = gradient(ctx, p, [
      [0, "#f3d9b1"],
      [1, "#e7c08e"],
    ]);
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = "#bfe3f2";
    ctx.fillRect(p.x + 18, p.y + 22, 70, 56);
    ctx.strokeStyle = "#8a5a35";
    ctx.lineWidth = 4;
    ctx.strokeRect(p.x + 18, p.y + 22, 70, 56);
    ctx.beginPath();
    ctx.moveTo(p.x + 53, p.y + 22);
    ctx.lineTo(p.x + 53, p.y + 78);
    ctx.stroke();
    for (const u of [0.5, 0.78]) {
      ctx.strokeStyle = "#3b2b20";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x + p.w * u, p.y);
      ctx.lineTo(p.x + p.w * u, p.y + 26);
      ctx.stroke();
      ctx.fillStyle = "#3b2b20";
      ctx.beginPath();
      ctx.moveTo(p.x + p.w * u - 16, p.y + 40);
      ctx.lineTo(p.x + p.w * u + 16, p.y + 40);
      ctx.lineTo(p.x + p.w * u + 7, p.y + 26);
      ctx.lineTo(p.x + p.w * u - 7, p.y + 26);
      ctx.fill();
      circle(ctx, p.x + p.w * u, p.y + 42, 5, "#ffe7a3");
    }
    ctx.fillStyle = "#8a5a35";
    ctx.fillRect(p.x, p.y + p.h - 30, p.w, 30);
    for (const u of [0.08, 0.92]) {
      circle(ctx, p.x + p.w * u, p.y + p.h - 18, 14, "#fbf8f2");
      circle(ctx, p.x + p.w * u, p.y + p.h - 18, 8, "#e9a04b");
    }
  },
  // The hackathon: a dark room lit by monitors with code on them, a pizza box and the clock.
  hackathon(ctx, p) {
    ctx.fillStyle = gradient(ctx, p, [
      [0, "#141a33"],
      [1, "#232a4d"],
    ]);
    ctx.fillRect(p.x, p.y, p.w, p.h);
    for (const [u, w] of [
      [0.05, 70],
      [0.38, 80],
      [0.72, 66],
    ] as const) {
      const x = p.x + p.w * u;
      ctx.fillStyle = "#0b0f1f";
      ctx.fillRect(x - 3, p.y + 18, w + 6, 52);
      ctx.fillStyle = "#16314a";
      ctx.fillRect(x, p.y + 21, w, 46);
      const code = ["#5ce0b8", "#c9a2f5", "#f2c46d", "#5ce0b8", "#8fb8ff"];
      code.forEach((color, line) => {
        ctx.fillStyle = color;
        ctx.fillRect(x + 6 + (line % 2) * 8, p.y + 27 + line * 8, w * (0.35 + ((line * 37) % 5) / 10), 3);
      });
    }
    ctx.fillStyle = "#ff5f7a";
    ctx.font = `700 18px ${sans}`;
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText("03:47", p.x + p.w - 10, p.y + 80);
    ctx.fillStyle = "#c8873d";
    ctx.fillRect(p.x + 8, p.y + p.h - 40, 50, 12);
  },
  // Coffee meeting: a café wall with a menu board, shelves of cups and a steaming mug.
  cafe(ctx, p) {
    ctx.fillStyle = gradient(ctx, p, [
      [0, "#7a5136"],
      [1, "#5e3b26"],
    ]);
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = "#2b2f2a";
    ctx.fillRect(p.x + p.w - 96, p.y + 14, 80, 64);
    ctx.fillStyle = "#f4f1e8";
    ctx.font = `16px ${handwriting}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("KOPI", p.x + p.w - 86, p.y + 20);
    ctx.fillRect(p.x + p.w - 86, p.y + 46, 56, 3);
    ctx.fillRect(p.x + p.w - 86, p.y + 58, 44, 3);
    ctx.fillStyle = "#c69c6d";
    ctx.fillRect(p.x + 10, p.y + 52, 110, 6);
    for (let cup = 0; cup < 4; cup++) {
      ctx.fillStyle = cup % 2 === 0 ? "#fbf8f2" : "#e2b33c";
      ctx.fillRect(p.x + 18 + cup * 26, p.y + 36, 16, 16);
    }
    ctx.fillStyle = "#fbf8f2";
    ctx.fillRect(p.x + 120, p.y + 90, 22, 22);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
    ctx.lineWidth = 2;
    for (const dx of [5, 13]) {
      ctx.beginPath();
      ctx.moveTo(p.x + 120 + dx, p.y + 86);
      ctx.bezierCurveTo(p.x + 114 + dx, p.y + 76, p.x + 126 + dx, p.y + 70, p.x + 120 + dx, p.y + 60);
      ctx.stroke();
    }
  },
  // The office birthday: pastel wall, bunting, balloons and confetti.
  party(ctx, p) {
    ctx.fillStyle = gradient(ctx, p, [
      [0, "#fde2ef"],
      [1, "#e8dcff"],
    ]);
    ctx.fillRect(p.x, p.y, p.w, p.h);
    const flags = ["#f5a8c2", "#9fe0c0", "#f7e27a", "#a9cdf5", "#c9a2f5"];
    for (let flag = 0; flag < 9; flag++) {
      const x = p.x + 6 + flag * 30;
      const sag = Math.sin((flag / 8) * Math.PI) * 14;
      ctx.fillStyle = flags[flag % flags.length] as string;
      ctx.beginPath();
      ctx.moveTo(x, p.y + 10 + sag);
      ctx.lineTo(x + 26, p.y + 10 + sag);
      ctx.lineTo(x + 13, p.y + 34 + sag);
      ctx.fill();
    }
    for (const [u, v, color] of [
      [0.08, 0.42, "#ff6b8b"],
      [0.18, 0.3, "#6bb8ff"],
      [0.86, 0.36, "#ffd25e"],
      [0.95, 0.46, "#9b6bff"],
    ] as const) {
      const x = p.x + p.w * u;
      const y = p.y + p.h * v;
      ctx.strokeStyle = "rgba(80, 80, 80, 0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y + 18);
      ctx.lineTo(x + 3, y + 60);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(x, y, 13, 17, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    let seed = 5;
    for (let bit = 0; bit < 40; bit++) {
      seed = (seed * 9301 + 49297) % 233280;
      const x = p.x + (seed / 233280) * p.w;
      seed = (seed * 9301 + 49297) % 233280;
      const y = p.y + 40 + (seed / 233280) * 60;
      ctx.fillStyle = flags[bit % flags.length] as string;
      ctx.fillRect(x, y, 5, 3);
    }
  },
};

/** One polaroid: white frame, the members' faces side by side, the caption in handwriting. */
function polaroid(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  caption: string,
  scene: PolaroidScene,
  faces: readonly MadingPhoto[],
): void {
  const width = 300;
  const height = 270;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
  ctx.fillRect(-width / 2 + 6, -height / 2 + 8, width, height);
  ctx.fillStyle = "#fbf8f2";
  ctx.fillRect(-width / 2, -height / 2, width, height);
  // The picture: the place it was taken, the faces in a row in front of it.
  const picture = { x: -width / 2 + 16, y: -height / 2 + 16, w: width - 32, h: 190 };
  ctx.save();
  ctx.beginPath();
  ctx.rect(picture.x, picture.y, picture.w, picture.h);
  ctx.clip();
  backdrops[scene](ctx, picture);
  ctx.restore();
  const face = Math.min(110, (picture.w - 12) / Math.max(1, faces.length));
  faces.forEach((member, index) => {
    const fx = picture.x + (picture.w - face * faces.length) / 2 + index * face;
    const fy = picture.y + picture.h - face - 10;
    ctx.save();
    ctx.beginPath();
    ctx.arc(fx + face / 2, fy + face / 2, face / 2 - 4, 0, Math.PI * 2);
    ctx.clip();
    if (member.photo !== null) {
      ctx.drawImage(member.photo, fx + 4, fy + 4, face - 8, face - 8);
    } else {
      ctx.fillStyle = "#c9b8e8";
      ctx.fillRect(fx, fy, face, face);
    }
    ctx.restore();
  });
  ctx.fillStyle = "#2b2b2b";
  ctx.font = `28px ${handwriting}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(caption, 0, height / 2 - 34);
  ctx.restore();
}

/** A square note pinned on, in marker handwriting. */
function note(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, text: string, color: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
  ctx.fillRect(-92, -82, 190, 170);
  ctx.fillStyle = color;
  ctx.fillRect(-96, -86, 190, 170);
  ctx.fillStyle = "#2b2b2b";
  ctx.font = `26px ${handwriting}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  wrapText(ctx, text, -80, -62, 160, 34);
  ctx.restore();
  pin(ctx, x, y - 70, "#c8323c");
}

/**
 * The left part of the board, about 1000 by 1040 canvas pixels: the title, five polaroids, four
 * notes, a fun fact card and stickers, laid out by hand so nothing hides anything to read.
 */
export function drawMading(ctx: CanvasRenderingContext2D, faces: readonly MadingPhoto[]): void {
  const facesFor = (indices: readonly number[]): MadingPhoto[] =>
    indices.map((index) => faces[index % Math.max(1, faces.length)] ?? { name: "", photo: null });

  // Title on a strip of paper, taped at both ends.
  ctx.save();
  ctx.translate(250, 70);
  ctx.rotate(-0.03);
  ctx.fillStyle = "#2a1a4a";
  ctx.fillRect(-210, -44, 420, 88);
  ctx.fillStyle = "#f4f1ec";
  ctx.font = `800 52px ${sans}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("MADING", -70, 0);
  ctx.fillStyle = "#c9a2f5";
  ctx.fillText("ALYX", 115, 0);
  ctx.restore();
  tape(ctx, 50, 40, -0.5, "#f5a8c2");
  tape(ctx, 450, 40, 0.5, "#9fe0c0");

  // The polaroids, scattered but each whole.
  const spots: readonly [number, number, number][] = [
    [190, 280, -0.06],
    [520, 250, 0.05],
    [180, 600, 0.04],
    [510, 580, -0.05],
    [800, 430, 0.03],
  ];
  polaroids.forEach((shot, index) => {
    const spot = spots[index];
    if (spot !== undefined) {
      polaroid(ctx, spot[0], spot[1], spot[2], shot.caption, shot.scene, facesFor(shot.members));
      tape(ctx, spot[0], spot[1] - 140, spot[2] * 2, index % 2 === 0 ? "#f7e27a" : "#a9cdf5");
    }
  });

  // Notes along the bottom.
  const noteSpots: readonly [number, number, number][] = [
    [130, 880, -0.05],
    [350, 900, 0.04],
    [570, 880, -0.03],
    [790, 890, 0.05],
  ];
  madingNotes.forEach((item, index) => {
    const spot = noteSpots[index];
    if (spot !== undefined) {
      note(ctx, spot[0], spot[1], spot[2], item.text, item.color);
    }
  });

  // A fun-fact card, like a "did you know?" tag. Everything on it is kept inside its edges.
  const card = { width: 270, height: 170 };
  ctx.save();
  ctx.translate(820, 140);
  ctx.rotate(0.04);
  ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
  ctx.fillRect(-card.width / 2 + 5, -card.height / 2 + 6, card.width, card.height);
  ctx.fillStyle = "#e2b33c";
  ctx.fillRect(-card.width / 2, -card.height / 2, card.width, card.height);
  ctx.beginPath();
  ctx.rect(-card.width / 2, -card.height / 2, card.width, card.height);
  ctx.clip();
  ctx.fillStyle = "#2b2b2b";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  fitFont(ctx, "TAHUKAH KAMU?", 800, 30, sans, card.width - 30);
  ctx.fillText("TAHUKAH KAMU?", 0, -card.height / 2 + 22);
  fitFont(ctx, "Mochi tidur sampai", 400, 26, handwriting, card.width - 40);
  wrapText(ctx, "Mochi tidur sampai 16 jam sehari", 0, -card.height / 2 + 66, card.width - 40, 32);
  ctx.restore();
  pin(ctx, 820, 66, "#5b3f78");

  // Stickers in the gaps.
  star(ctx, 625, 60, 26, "#b45cff");
  star(ctx, 360, 440, 20, "#f2c46d");
  star(ctx, 930, 300, 22, "#f5a8c2");
  star(ctx, 60, 440, 18, "#9fe0c0");
}
