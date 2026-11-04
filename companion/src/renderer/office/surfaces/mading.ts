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

/** The polaroids: who is in each and the caption written under it. */
export const polaroids: readonly { caption: string; members: readonly number[] }[] = [
  { caption: "Outing ke Puncak", members: [0, 1, 2] },
  { caption: "Makan siang tim", members: [3, 4] },
  { caption: "Hackathon 24 jam", members: [5, 6, 7] },
  { caption: "Rapat sambil ngopi", members: [8, 9] },
  { caption: "Ultah kantor", members: [10, 11] },
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

/** One polaroid: white frame, the members' faces side by side, the caption in handwriting. */
function polaroid(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  caption: string,
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
  // The picture: a sky-to-park backdrop like an outdoor snap, the faces in a row on it.
  const picture = { x: -width / 2 + 16, y: -height / 2 + 16, w: width - 32, h: 190 };
  const sky = ctx.createLinearGradient(0, picture.y, 0, picture.y + picture.h);
  sky.addColorStop(0, "#9fd0f0");
  sky.addColorStop(0.65, "#cfe8c4");
  sky.addColorStop(1, "#7fb26a");
  ctx.fillStyle = sky;
  ctx.fillRect(picture.x, picture.y, picture.w, picture.h);
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
      polaroid(ctx, spot[0], spot[1], spot[2], shot.caption, facesFor(shot.members));
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

  // A fun-fact card, like a "did you know?" tag.
  ctx.save();
  ctx.translate(820, 130);
  ctx.rotate(0.04);
  ctx.fillStyle = "#e2b33c";
  ctx.fillRect(-130, -70, 260, 140);
  ctx.fillStyle = "#2b2b2b";
  ctx.font = `800 30px ${sans}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("TAHUKAH KAMU?", 0, -56);
  ctx.font = `24px ${handwriting}`;
  wrapText(ctx, "Mochi tidur sampai 16 jam sehari", -100, -14, 200, 30);
  ctx.restore();
  pin(ctx, 820, 70, "#5b3f78");

  // Stickers in the gaps.
  star(ctx, 690, 70, 26, "#b45cff");
  star(ctx, 360, 440, 20, "#f2c46d");
  star(ctx, 930, 300, 22, "#f5a8c2");
  star(ctx, 60, 440, 18, "#9fe0c0");
}
