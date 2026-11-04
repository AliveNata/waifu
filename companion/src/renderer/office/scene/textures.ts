import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from "three";
import { palette } from "./palette.js";

const uiFont = "'Segoe UI', system-ui, sans-serif";

function canvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const element = document.createElement("canvas");
  element.width = width;
  element.height = height;
  const ctx = element.getContext("2d");
  if (ctx === null) {
    throw new Error("2D canvas is not available");
  }
  return { canvas: element, ctx };
}

function texture(element: HTMLCanvasElement): CanvasTexture {
  const result = new CanvasTexture(element);
  result.colorSpace = SRGBColorSpace;
  result.anisotropy = 4;
  return result;
}

/** Label every simulated screen as such, so nobody mistakes it for real work while screen sharing. */
function simulatedTag(ctx: CanvasRenderingContext2D, width: number, color: string): void {
  ctx.font = `14px ${uiFont}`;
  ctx.fillStyle = color;
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.fillText("simulasi", width - 12, 10);
  ctx.textAlign = "left";
}

/** Light oak planks. The seams give the floor scale, so the people read as people in a real room. */
export function floorTexture(): CanvasTexture {
  const { canvas: element, ctx } = canvas(512, 512);
  ctx.fillStyle = palette.floor;
  ctx.fillRect(0, 0, 512, 512);
  const plank = 64;
  for (let row = 0; row < 512 / plank; row++) {
    const y = row * plank;
    ctx.fillStyle = row % 2 === 0 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)";
    ctx.fillRect(0, y, 512, plank);
    ctx.fillStyle = palette.floorSeam;
    ctx.fillRect(0, y, 512, 2);
    const offset = (row * 173) % 512;
    ctx.fillRect(offset, y, 2, plank);
    ctx.fillRect((offset + 256) % 512, y, 2, plank);
  }
  const result = texture(element);
  result.wrapS = RepeatWrapping;
  result.wrapT = RepeatWrapping;
  return result;
}

/**
 * The view through the back windows: a soft sky over a low skyline, no detail to compete with the
 * room. At night the sky goes navy and a scatter of lit office windows shows in the towers.
 */
/** The view out of a window: clear day, the orange and pink of dawn or dusk, or the city at night. */
export type WindowView = "day" | "twilight" | "night";

const skyColors: Record<WindowView, readonly [string, string, string]> = {
  day: ["#b9d7f0", "#eaf2f7", "#f6efe4"],
  twilight: ["#3f4f8f", "#e98a6a", "#ffcf8f"],
  night: ["#0d1230", "#24204a", "#3a2a5c"],
};

export function windowTexture(seed: number, view: WindowView = "day"): CanvasTexture {
  const { canvas: element, ctx } = canvas(512, 256);
  const sky = ctx.createLinearGradient(0, 0, 0, 256);
  const [top, middle, bottom] = skyColors[view];
  sky.addColorStop(0, top);
  sky.addColorStop(0.75, middle);
  sky.addColorStop(1, bottom);
  const night = view !== "day";
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 512, 256);
  let x = 0;
  let step = seed;
  while (x < 512) {
    step = (step * 9301 + 49297) % 233280;
    const towerWidth = 30 + (step % 50);
    const towerHeight = 40 + (step % 90);
    const towerTop = 256 - towerHeight;
    if (night) {
      // At dusk the towers are dark against the glow, with fewer windows lit so far.
      ctx.fillStyle =
        view === "twilight" ? (step % 3 === 0 ? "#3a2f4f" : "#47375a") : step % 3 === 0 ? "#151632" : "#1c1b3d";
      ctx.fillRect(x, towerTop, towerWidth - 4, towerHeight);
      for (let wy = towerTop + 8; wy < 250; wy += 12) {
        for (let wx = x + 5; wx < x + towerWidth - 9; wx += 9) {
          step = (step * 9301 + 49297) % 233280;
          if (step % (view === "twilight" ? 11 : 5) === 0) {
            ctx.fillStyle = step % 2 === 0 ? "#ffd98a" : "#cfa0ff";
            ctx.fillRect(wx, wy, 4, 5);
          }
        }
      }
    } else {
      ctx.fillStyle = step % 3 === 0 ? "#c4cbd6" : "#d2d8e0";
      ctx.fillRect(x, towerTop, towerWidth - 4, towerHeight);
    }
    x += towerWidth;
  }
  return texture(element);
}

/**
 * "AlyxLabs" lettering, set in the UI face so it matches the companion's own text. The default
 * colors suit the light wall; the dark backdrop passes lighter ones.
 */
export interface SignLettering {
  texture: CanvasTexture;
  /** Where the ink starts and ends, as fractions of the texture width, so a layout can center the words themselves. */
  inkStart: number;
  inkEnd: number;
}

export function signTextTexture(alyxColor: string = palette.inkDeep, labsColor = "#8a3fd6"): SignLettering {
  const { canvas: element, ctx } = canvas(1024, 256);
  ctx.clearRect(0, 0, 1024, 256);
  ctx.textBaseline = "middle";
  ctx.font = `700 150px ${uiFont}`;
  ctx.fillStyle = alyxColor;
  ctx.fillText("Alyx", 10, 130);
  const alyxWidth = ctx.measureText("Alyx").width;
  ctx.fillStyle = labsColor;
  ctx.fillText("Labs", 10 + alyxWidth, 130);
  const inkEnd = 10 + alyxWidth + ctx.measureText("Labs").width;
  return { texture: texture(element), inkStart: 10 / 1024, inkEnd: Math.min(1, inkEnd / 1024) };
}

/**
 * A line of wall lettering lit like a neon tube: a near-white core in the brand purple's glow,
 * on a transparent ground. The size shrinks to fit long lines into the same width.
 */
export function quoteTexture(text: string): CanvasTexture {
  const width = 1024;
  const height = 200;
  const { canvas: element, ctx } = canvas(width, height);
  ctx.clearRect(0, 0, width, height);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let size = 96;
  ctx.font = `700 ${size}px ${uiFont}`;
  const room = width - 80;
  const measured = ctx.measureText(text).width;
  if (measured > room) {
    size = Math.floor((size * room) / measured);
    ctx.font = `700 ${size}px ${uiFont}`;
  }
  // Two glow passes, wide and faint then tight and bright, then the tube itself.
  ctx.shadowColor = "#b45cff";
  ctx.fillStyle = "#c98bff";
  ctx.shadowBlur = 36;
  ctx.fillText(text, width / 2, height / 2);
  ctx.shadowBlur = 12;
  ctx.fillText(text, width / 2, height / 2);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#f7efff";
  ctx.fillText(text, width / 2, height / 2);
  return texture(element);
}

/**
 * One half of the name on the entry doors, in the sign's lettering: "Alyx" set against the right
 * edge of the left door and "Labs" against the left edge of the right one, so the closed doors
 * read as one word that splits as they slide apart. Transparent around the letters, for glass.
 */
export function doorLetteringTexture(word: "Alyx" | "Labs", color: string): CanvasTexture {
  const { canvas: element, ctx } = canvas(512, 180);
  ctx.clearRect(0, 0, 512, 180);
  ctx.textBaseline = "middle";
  ctx.font = `700 140px ${uiFont}`;
  ctx.fillStyle = color;
  // The two halves meet at the doors' seam: the ink, not the glyph box, goes right up to the
  // edge, leaving only the gap a letter would have, so the shut doors read "AlyxLabs".
  const ink = ctx.measureText(word);
  const letterGap = 5;
  const x = word === "Alyx" ? 512 - letterGap - ink.actualBoundingBoxRight : letterGap + ink.actualBoundingBoxLeft;
  ctx.fillText(word, x, 94);
  return texture(element);
}

/** Asuna's side monitor: pipeline stages as a DAG, each with a status dot. Shapes only, no made-up numbers. */
export function pipelineTexture(): CanvasTexture {
  const { canvas: element, ctx } = canvas(640, 400);
  ctx.fillStyle = "#1b1f2a";
  ctx.fillRect(0, 0, 640, 400);
  ctx.fillStyle = "#e6e8ee";
  ctx.font = `bold 18px ${uiFont}`;
  ctx.textBaseline = "top";
  ctx.fillText("airflow: daily_orders", 16, 12);
  simulatedTag(ctx, 640, "#7c8396");
  const nodes: [string, number, number][] = [
    ["extract", 40, 110],
    ["stg_orders", 230, 70],
    ["stg_customers", 230, 170],
    ["fct_daily_orders", 430, 120],
    ["check_freshness", 430, 260],
  ];
  const edges: [number, number][] = [
    [0, 1],
    [0, 2],
    [1, 3],
    [2, 3],
    [3, 4],
  ];
  ctx.strokeStyle = "#7c8396";
  ctx.lineWidth = 3;
  for (const [from, to] of edges) {
    const a = nodes[from] as [string, number, number];
    const b = nodes[to] as [string, number, number];
    ctx.beginPath();
    ctx.moveTo(a[1] + 170, a[2] + 22);
    ctx.lineTo(b[1], b[2] + 22);
    ctx.stroke();
  }
  ctx.font = `16px ${uiFont}`;
  for (const [label, x, y] of nodes) {
    ctx.fillStyle = "#2a3040";
    ctx.fillRect(x, y, 170, 44);
    ctx.fillStyle = "#5fd38d";
    ctx.beginPath();
    ctx.arc(x + 16, y + 22, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e6e8ee";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + 30, y + 22);
  }
  return texture(element);
}

/** Erza's portrait monitor: the review checklist she works down. */
export function checklistTexture(): CanvasTexture {
  const { canvas: element, ctx } = canvas(400, 640);
  ctx.fillStyle = "#1d1a1c";
  ctx.fillRect(0, 0, 400, 640);
  ctx.fillStyle = "#ece6e6";
  ctx.font = `bold 22px ${uiFont}`;
  ctx.textBaseline = "top";
  ctx.fillText("Checklist review", 18, 18);
  simulatedTag(ctx, 400, "#857a7d");
  const items = ["lint", "typecheck", "tests", "error handling", "secret di diff", "SQL style", "manifest K8s"];
  ctx.font = `20px ${uiFont}`;
  items.forEach((item, index) => {
    const y = 80 + index * 70;
    ctx.strokeStyle = "#e35d5d";
    ctx.lineWidth = 3;
    ctx.strokeRect(20, y, 28, 28);
    if (index < 4) {
      ctx.beginPath();
      ctx.moveTo(25, y + 14);
      ctx.lineTo(33, y + 23);
      ctx.lineTo(45, y + 5);
      ctx.stroke();
    }
    ctx.fillStyle = "#ece6e6";
    ctx.textBaseline = "middle";
    ctx.fillText(item, 64, y + 14);
    ctx.textBaseline = "top";
  });
  return texture(element);
}

/** Yor's second monitor: node health as line shapes, the view an SRE leaves open all day. */
export function monitoringTexture(): CanvasTexture {
  const { canvas: element, ctx } = canvas(640, 400);
  ctx.fillStyle = "#0f1512";
  ctx.fillRect(0, 0, 640, 400);
  ctx.fillStyle = "#d8eadf";
  ctx.font = `bold 18px ${uiFont}`;
  ctx.textBaseline = "top";
  ctx.fillText("monitoring: cluster-dev", 16, 12);
  simulatedTag(ctx, 640, "#6f8a7a");
  const panels: [number, number][] = [
    [20, 50],
    [330, 50],
    [20, 225],
    [330, 225],
  ];
  panels.forEach(([x, y], panel) => {
    ctx.strokeStyle = "#1a2620";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, 290, 160);
    ctx.strokeStyle = panel === 3 ? "#e3b35d" : "#5fd38d";
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let step = 0; step <= 28; step++) {
      const value = 0.5 + 0.3 * Math.sin(step * 0.6 + panel * 1.7) * Math.cos(step * 0.23 + panel);
      const px = x + 10 + step * 10;
      const py = y + 150 - value * 130;
      if (step === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.stroke();
  });
  return texture(element);
}

/** Arisu's sprint board: who has which task, with team names so the board ties back to the cast. */
export function kanbanTexture(): CanvasTexture {
  const { canvas: element, ctx } = canvas(1024, 640);
  ctx.fillStyle = "#fbfaf7";
  ctx.fillRect(0, 0, 1024, 640);
  ctx.fillStyle = palette.inkDeep;
  ctx.font = `bold 34px ${uiFont}`;
  ctx.textBaseline = "top";
  ctx.fillText("Sprint tim", 28, 22);
  simulatedTag(ctx, 1024, "#7a7f8c");
  const columns: [string, [string, string][]][] = [
    [
      "Backlog",
      [
        ["Ide fitur", "Chizuru"],
        ["Draft LinkedIn", "Ruby"],
      ],
    ],
    [
      "Running",
      [
        ["Model dbt", "Asuna"],
        ["API + chart", "Kobayashi"],
        ["Flow onboarding", "Huagua"],
      ],
    ],
    [
      "Review",
      [
        ["Cek diff", "Erza"],
        ["Cek secret", "Miruku"],
      ],
    ],
    [
      "Done",
      [
        ["Opsi arsitektur", "Rias"],
        ["Kontrak API", "Komachi"],
        ["Dry-run deploy", "Yor"],
      ],
    ],
  ];
  columns.forEach(([title, cards], column) => {
    const x = 24 + column * 250;
    ctx.fillStyle = "#efe9f6";
    ctx.fillRect(x, 84, 234, 530);
    ctx.fillStyle = palette.inkDeep;
    ctx.font = `bold 26px ${uiFont}`;
    ctx.fillText(title, x + 14, 98);
    cards.forEach(([task, owner], index) => {
      const y = 150 + index * 120;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x + 12, y, 210, 100);
      ctx.fillStyle = palette.accent;
      ctx.fillRect(x + 12, y, 210, 8);
      ctx.fillStyle = "#1f2433";
      ctx.font = `22px ${uiFont}`;
      ctx.fillText(task, x + 24, y + 22);
      ctx.fillStyle = "#5a5f6c";
      ctx.font = `18px ${uiFont}`;
      ctx.fillText(owner, x + 24, y + 60);
    });
  });
  return texture(element);
}

/** Portrait side monitor: a scrolling list, the kind of thing people keep on a vertical screen. */
function feedTexture(title: string, rows: readonly string[], background: string, text: string, mark: string) {
  const { canvas: element, ctx } = canvas(400, 640);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, 400, 640);
  ctx.fillStyle = text;
  ctx.font = `bold 22px ${uiFont}`;
  ctx.textBaseline = "top";
  ctx.fillText(title, 18, 18);
  simulatedTag(ctx, 400, mark);
  ctx.font = `17px ${uiFont}`;
  rows.forEach((row, index) => {
    const y = 72 + index * 52;
    ctx.fillStyle = mark;
    ctx.fillRect(18, y + 4, 6, 26);
    ctx.fillStyle = text;
    ctx.fillText(row, 36, y + 8);
  });
  return texture(element);
}

/** Asuna's vertical monitor: recent job runs, newest on top. */
export function jobRunsTexture(): CanvasTexture {
  return feedTexture(
    "Job runs",
    [
      "dbt run  ok",
      "airflow dag  ok",
      "kafka lag  12",
      "bq load  ok",
      "spark job  jalan",
      "dbt test  ok",
      "backfill  antri",
    ],
    "#101722",
    "#d9e4f2",
    "#5fa8d3",
  );
}

/** Kobayashi's vertical monitor: docs and the open PR list beside the ultrawide. */
export function pullRequestsTexture(): CanvasTexture {
  return feedTexture(
    "Pull requests",
    ["feat: chart API", "fix: form validasi", "chore: deps", "docs: README", "test: e2e login", "refactor: hooks"],
    "#14121c",
    "#ece8f4",
    "#b45cff",
  );
}

/** Komachi's second monitor: how the pieces of the feature meet, the contracts she writes up. */
export function contractDiagramTexture(): CanvasTexture {
  const { canvas: element, ctx } = canvas(640, 400);
  ctx.fillStyle = "#171a2b";
  ctx.fillRect(0, 0, 640, 400);
  ctx.fillStyle = "#dfe3f7";
  ctx.font = `bold 18px ${uiFont}`;
  ctx.textBaseline = "top";
  ctx.fillText("kontrak: orders", 16, 12);
  simulatedTag(ctx, 640, "#7f86a8");
  const nodes: [string, string, number, number][] = [
    ["web", "Kobayashi", 30, 80],
    ["api", "Kobayashi", 240, 80],
    ["postgres", "Asuna", 450, 60],
    ["topic orders.v1", "Asuna", 450, 170],
    ["dbt", "Asuna", 450, 280],
    ["deploy", "Yor", 240, 260],
  ];
  const edges: [number, number][] = [
    [0, 1],
    [1, 2],
    [1, 3],
    [3, 4],
    [1, 5],
  ];
  ctx.strokeStyle = "#a9b8ff";
  ctx.lineWidth = 3;
  for (const [from, to] of edges) {
    const a = nodes[from] as [string, string, number, number];
    const b = nodes[to] as [string, string, number, number];
    ctx.beginPath();
    ctx.moveTo(a[2] + 80, a[3] + 28);
    ctx.lineTo(b[2] + 80, b[3] + 28);
    ctx.stroke();
  }
  for (const [label, owner, x, y] of nodes) {
    ctx.fillStyle = "#262b45";
    ctx.fillRect(x, y, 160, 56);
    ctx.strokeStyle = "#a9b8ff";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, 160, 56);
    ctx.fillStyle = "#dfe3f7";
    ctx.font = `bold 17px ${uiFont}`;
    ctx.textBaseline = "top";
    ctx.fillText(label, x + 12, y + 8);
    ctx.fillStyle = "#9aa2c4";
    ctx.font = `14px ${uiFont}`;
    ctx.fillText(owner, x + 12, y + 32);
  }
  return texture(element);
}

/** Miruku's vertical monitor: the checks she runs before anything ships. */
export function securityLogTexture(): CanvasTexture {
  return feedTexture(
    "Security log",
    [
      "secret scan  bersih",
      "npm audit  cek",
      "rbac diff  cek",
      "iam role  ok",
      "port publik  cek",
      "input sql  ok",
      "dependency  antri",
    ],
    "#16121f",
    "#e6dcf7",
    "#d2b8ff",
  );
}

/**
 * 2B's desk calendar page: the month on a dark band, the days as a grid, today circled in the
 * accent color. Drawn once when the office is built, from the office's own clock zone.
 */
export function calendarTexture(now: Date = new Date()): CanvasTexture {
  const { canvas: element, ctx } = canvas(128, 112);
  const zone = { timeZone: "Asia/Jakarta" } as const;
  const month = now
    .toLocaleString("id-ID", { ...zone, month: "short" })
    .replace(".", "")
    .toUpperCase();
  const today = Number(now.toLocaleString("en-US", { ...zone, day: "numeric" }));
  ctx.fillStyle = "#f7f3ea";
  ctx.fillRect(0, 0, 128, 112);
  ctx.fillStyle = "#2d3a5c";
  ctx.fillRect(0, 0, 128, 30);
  ctx.fillStyle = "#f7f3ea";
  ctx.font = `600 20px ${uiFont}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(month, 64, 16);
  const cell = { width: 16, height: 15 };
  for (let day = 1; day <= 31; day++) {
    const column = (day - 1) % 7;
    const row = Math.floor((day - 1) / 7);
    const x = 10 + column * cell.width + cell.width / 2;
    const y = 38 + row * cell.height + cell.height / 2;
    if (day === today) {
      ctx.strokeStyle = palette.accent;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = day === today ? palette.accent : "#3a3058";
    ctx.font = `500 9px ${uiFont}`;
    ctx.fillText(String(day), x, y);
  }
  return texture(element);
}

/** The red APPROVED mark Erza's stamp leaves on a sheet. */
export function approvedTexture(): CanvasTexture {
  const { canvas: element, ctx } = canvas(160, 64);
  ctx.fillStyle = "#f7f3ea";
  ctx.fillRect(0, 0, 160, 64);
  ctx.strokeStyle = "#c0392b";
  ctx.lineWidth = 5;
  ctx.strokeRect(6, 6, 148, 52);
  ctx.fillStyle = "#c0392b";
  ctx.font = `800 26px ${uiFont}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("APPROVED", 80, 33);
  return texture(element);
}

/** Huagua's mood board: photo blocks, swatches and a type sample pinned on cork. */
export function moodboardTexture(): CanvasTexture {
  const { canvas: element, ctx } = canvas(160, 128);
  ctx.fillStyle = "#d9b48a";
  ctx.fillRect(0, 0, 160, 128);
  const blocks: readonly [number, number, number, number, string][] = [
    [10, 10, 52, 38, "#9fd2b0"],
    [70, 12, 40, 30, "#f4a6c4"],
    [116, 10, 34, 46, "#5fa8d3"],
    [12, 58, 36, 50, "#f7f3ea"],
    [56, 50, 50, 34, "#8a5fd0"],
    [112, 64, 38, 22, "#e8833a"],
  ];
  for (const [x, y, width, height, color] of blocks) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);
  }
  ctx.fillStyle = "#2a2140";
  ctx.font = `700 22px ${uiFont}`;
  ctx.textBaseline = "top";
  ctx.fillText("Aa", 18, 70);
  ctx.fillStyle = "#c0392b";
  for (const [x, y] of [
    [36, 12],
    [90, 14],
    [133, 12],
    [80, 52],
  ] as const) {
    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  return texture(element);
}
