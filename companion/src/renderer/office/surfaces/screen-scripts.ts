import type { MemberId } from "../../../shared/team.js";
import type { ScreenDocument } from "./typing.js";

/**
 * Simulated screen content. Nothing here comes from the user's real work: the
 * user chose simulated screens so the office is safe to show while screen sharing.
 */
export interface ScreenScript {
  theme: { background: string; foreground: string; accent: string; muted: string; header: string };
  /** Words colored with the accent, to read as syntax highlighting. */
  keywords: readonly string[];
  documents: readonly ScreenDocument[];
}

const sqlKeywords = [
  "select",
  "from",
  "left",
  "inner",
  "join",
  "on",
  "where",
  "group",
  "by",
  "with",
  "as",
  "and",
  "order",
  "count",
  "sum",
];

export const screenScripts: Record<MemberId, ScreenScript> = {
  asuna: {
    theme: { background: "#1b1f2a", foreground: "#e6e8ee", accent: "#f0a35e", muted: "#7c8396", header: "#2a3040" },
    keywords: sqlKeywords,
    documents: [
      {
        title: "models/marts/fct_daily_orders.sql",
        text: [
          "with orders as (",
          "    select order_id, customer_id, order_ts, amount",
          "    from {{ ref('stg_orders') }}",
          "),",
          "",
          "customers as (",
          "    select customer_id, region",
          "    from {{ ref('stg_customers') }}",
          ")",
          "",
          "select",
          "    date(o.order_ts) as order_date,",
          "    c.region,",
          "    count(o.order_id) as order_count,",
          "    sum(o.amount) as revenue",
          "from orders as o",
          "left join customers as c",
          "    on o.customer_id = c.customer_id",
          "group by order_date, c.region",
        ].join("\n"),
      },
      {
        title: "dags/daily_orders.py",
        text: [
          "from airflow.decorators import dag, task",
          "",
          "@dag(schedule='0 2 * * *', catchup=False)",
          "def daily_orders() -> None:",
          "    @task",
          "    def run_dbt() -> None:",
          "        build('fct_daily_orders')",
          "",
          "    @task",
          "    def check_freshness() -> None:",
          "        assert_fresh('fct_daily_orders', hours=26)",
          "",
          "    run_dbt() >> check_freshness()",
        ].join("\n"),
      },
    ],
  },
  kobayashi: {
    theme: { background: "#1e1e24", foreground: "#e8e6e3", accent: "#e0705a", muted: "#7d7a86", header: "#2c2c35" },
    keywords: ["import", "from", "export", "function", "const", "return", "await", "async", "interface", "type"],
    documents: [
      {
        title: "src/api/orders.ts",
        text: [
          "import { db } from './db';",
          "",
          "export interface OrderSummary {",
          "  orderDate: string;",
          "  region: string;",
          "  revenue: number;",
          "}",
          "",
          "export async function listSummaries(",
          "  region: string,",
          "): Promise<OrderSummary[]> {",
          "  const rows = await db.query(",
          "    'select order_date, region, revenue ' +",
          "      'from fct_daily_orders where region = $1',",
          "    [region],",
          "  );",
          "  return rows.map(toSummary);",
          "}",
        ].join("\n"),
      },
      {
        title: "src/ui/RevenueChart.tsx",
        text: [
          "export function RevenueChart({ rows }: Props) {",
          "  if (rows.length === 0) {",
          "    return <Empty>Belum ada data</Empty>;",
          "  }",
          "  return (",
          "    <LineChart data={rows} x='orderDate'",
          "      y='revenue' label='Revenue per hari' />",
          "  );",
          "}",
        ].join("\n"),
      },
    ],
  },
  yor: {
    theme: { background: "#0f1512", foreground: "#d8eadf", accent: "#5fd38d", muted: "#6f8a7a", header: "#1a2620" },
    keywords: ["kubectl", "helm", "get", "diff", "describe", "logs", "Running", "Ready"],
    documents: [
      {
        title: "terminal: cluster-dev",
        text: [
          "$ kubectl config current-context",
          "cluster-dev",
          "$ kubectl get pods -n data",
          "NAME                       READY  STATUS",
          "orders-api-7d9f8-2kq4x     1/1    Running",
          "orders-api-7d9f8-x8m2p     1/1    Running",
          "dbt-runner-5c6b4-hw7rt     1/1    Running",
          "kafka-consumer-0           1/1    Running",
          "$ kubectl diff -f k8s/orders-api.yaml",
          "-  replicas: 2",
          "+  replicas: 3",
          "# perubahan siap, nunggu konfirmasi",
        ].join("\n"),
      },
      {
        title: "k8s/orders-api.yaml",
        text: [
          "apiVersion: apps/v1",
          "kind: Deployment",
          "metadata:",
          "  name: orders-api",
          "  namespace: data",
          "spec:",
          "  replicas: 3",
          "  template:",
          "    spec:",
          "      containers:",
          "        - name: api",
          "          image: orders-api:1.4.2",
        ].join("\n"),
      },
    ],
  },
  erza: {
    theme: { background: "#1d1a1c", foreground: "#ece6e6", accent: "#e35d5d", muted: "#857a7d", header: "#2c2629" },
    keywords: ["PASS", "FAIL", "+", "-"],
    documents: [
      {
        title: "review: orders-summary",
        text: [
          "--- a/src/api/orders.ts",
          "+++ b/src/api/orders.ts",
          "-  return rows;",
          "+  return rows.map(toSummary);",
          "",
          "lint       PASS",
          "typecheck  PASS",
          "tests      PASS  42/42",
          "",
          "Verdict: PASS",
          "1. orders.ts:14 region belum divalidasi",
          "   (minor, bukan blocker)",
        ].join("\n"),
      },
    ],
  },
  twob: {
    theme: { background: "#f6f4ef", foreground: "#1f2433", accent: "#2f6fd6", muted: "#7a7f8c", header: "#e2ddd2" },
    keywords: ["Plan", "[x]", "[ ]", "->"],
    documents: [
      {
        title: "plan: dashboard revenue",
        text: [
          "Plan",
          "[x] brainstorm -> Chizuru",
          "[x] opsi arsitektur -> Rias",
          "[ ] model dbt -> Asuna",
          "[ ] API + chart -> Kobayashi",
          "[ ] deploy dry-run -> Yor",
          "[ ] review -> Erza",
          "",
          "Nunggu approval lo",
        ].join("\n"),
      },
    ],
  },
  rias: {
    theme: { background: "#1e1a22", foreground: "#ece6ea", accent: "#e0566a", muted: "#8c8090", header: "#2e2733" },
    keywords: ["Konteks", "Opsi", "Keputusan", "Konsekuensi", "Status", "Diterima"],
    documents: [
      {
        title: "adr/0007-orders-ke-warehouse.md",
        text: [
          "Status: diusulkan",
          "",
          "Konteks",
          "  Dashboard revenue butuh data order harian.",
          "",
          "Opsi",
          "  A. Airflow + dbt ke BigQuery",
          "  B. Stream lewat Kafka, materialize di Postgres",
          "",
          "Keputusan",
          "  A dulu. Laporan cukup harian,",
          "  tim udah biasa pakai dbt.",
          "",
          "Konsekuensi",
          "  Data telat sampai job jam 2 selesai.",
        ].join("\n"),
      },
      {
        title: "notes/tradeoff.md",
        text: [
          "Batch vs stream",
          "  batch: murah, gampang di-retry",
          "  stream: segar, tapi butuh on-call",
          "",
          "Tanya ke 2B: SLA laporannya apa?",
        ].join("\n"),
      },
    ],
  },
  chizuru: {
    theme: { background: "#fffaf0", foreground: "#2d2a26", accent: "#e8833a", muted: "#958a7c", header: "#fbe7c6" },
    keywords: ["Ide", "Gimana", "kalau", "?", "+"],
    documents: [
      {
        title: "brainstorm/dashboard-revenue.md",
        text: [
          "Ide liar dulu, saring belakangan",
          "",
          "+ revenue per region, per hari",
          "+ gimana kalau ada alert pas turun drastis?",
          "+ bandingin minggu ini vs minggu lalu",
          "+ filter per channel penjualan",
          "+ tombol export buat tim finance",
          "",
          "Pertanyaan buat Rias:",
          "  harus real time atau cukup harian?",
        ].join("\n"),
      },
    ],
  },
  ruby: {
    theme: { background: "#fff7fa", foreground: "#2b2230", accent: "#c8407a", muted: "#8a7884", header: "#f6dde8" },
    keywords: ["#dataengineering", "#dbt", "#airflow", "Masalah", "Pendekatan", "Hasil", "Stack"],
    documents: [
      {
        title: "drafts/linkedin-post.md",
        text: [
          "Minggu ini gua mindahin job order harian",
          "dari cron ke Airflow + dbt.",
          "",
          "Yang berubah:",
          "- tiap model dbt punya test freshness",
          "- deploy selalu lewat dry-run dulu",
          "- dashboard baca langsung dari mart",
          "",
          "Paling kepake: lineage dbt bikin",
          "debugging jauh lebih cepet dirunut.",
          "",
          "#dataengineering #dbt #airflow",
        ].join("\n"),
      },
      {
        title: "drafts/notion-case-study.md",
        text: [
          "Masalah",
          "  Job cron susah dipantau dan di-retry.",
          "Pendekatan",
          "  DAG Airflow, model dbt, test freshness.",
          "Hasil",
          "  (isi dari angka asli lo, jangan dikarang)",
          "Stack",
          "  Airflow, dbt, BigQuery, Kubernetes",
        ].join("\n"),
      },
    ],
  },
};
