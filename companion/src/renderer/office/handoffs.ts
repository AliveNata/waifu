import type { MemberId } from "../../shared/team.js";

/**
 * Work changing hands in the office, driven by the real hook events: when 2B delegates, she walks
 * a brief over to the teammate's desk; when a teammate's run ends, they walk their report over to
 * 2B's desk. This module only decides who walks where and when; the stage moves them.
 */

export type Teammate = Exclude<MemberId, "twob">;
export type ReportSpot = "report-1" | "report-2" | "report-3";

/** Where someone should be for a handoff, and what they do once there. */
export interface HandoffPlan {
  station: `visit-${Teammate}` | ReportSpot;
  action: "hand-over" | "wait-report";
  /** A brief or a report in hand while walking and waiting. */
  carrying: boolean;
}

/** How long a brief or report takes to hand over once the two are face to face. */
export const handOverSeconds = 2.5;
/**
 * A handoff that has not finished in this long is dropped: the walk was blocked, or the work has
 * long since moved on, and the office should not keep acting out stale events.
 */
export const staleHandoffMs = 60_000;
/** Spots in front of 2B's desk, the first one handing over and the rest waiting their turn. */
export const reportSpots: readonly ReportSpot[] = ["report-1", "report-2", "report-3"];
/**
 * 2B delivers at most this many briefs in one round. More delegations than that at once and the
 * rest just start at their desks, so she is not walking laps while the work is already running.
 */
export const maxPendingBriefs = 3;

interface Pending {
  member: Teammate;
  queuedAt: number;
  /** When the walker reached the handoff spot, or null while still on the way. */
  arrivedAt: number | null;
}

export class Handoffs {
  private briefs: Pending[] = [];
  private reports: Pending[] = [];

  /** 2B handed a task to a teammate. */
  delegated(member: Teammate, now: number): void {
    // A new task wins over walking the last report over.
    this.reports = this.reports.filter((report) => report.member !== member);
    if (this.briefs.some((brief) => brief.member === member) || this.briefs.length >= maxPendingBriefs) {
      return;
    }
    this.briefs.push({ member, queuedAt: now, arrivedAt: null });
  }

  /** A teammate's last run ended: they bring their report to 2B. */
  finished(member: Teammate, now: number): void {
    if (this.reports.some((report) => report.member === member) || this.reports.length >= reportSpots.length) {
      return;
    }
    this.reports.push({ member, queuedAt: now, arrivedAt: null });
  }

  /** Drops whatever has finished or gone stale. Call once per frame before asking for plans. */
  update(now: number): void {
    const live = (pending: Pending): boolean =>
      now - pending.queuedAt < staleHandoffMs &&
      (pending.arrivedAt === null || now - pending.arrivedAt < handOverSeconds * 1000);
    this.briefs = this.briefs.filter(live);
    // Only the first in line hands over; the ones behind it keep waiting until they move up.
    const [first, ...waiting] = this.reports;
    this.reports =
      first === undefined
        ? []
        : [...(live(first) ? [first] : []), ...waiting.filter((r) => now - r.queuedAt < staleHandoffMs)];
  }

  /** The handoff this member is part of right now, or null to carry on as usual. */
  planFor(memberId: MemberId): HandoffPlan | null {
    if (memberId === "twob") {
      const brief = this.briefs[0];
      if (brief === undefined) {
        return null;
      }
      return {
        station: `visit-${brief.member}`,
        action: "hand-over",
        // The brief stays in hand until it has been handed over.
        carrying: true,
      };
    }
    const index = this.reports.findIndex((report) => report.member === memberId);
    const spot = reportSpots[index];
    if (index < 0 || spot === undefined) {
      return null;
    }
    return { station: spot, action: index === 0 ? "hand-over" : "wait-report", carrying: true };
  }

  /**
   * The member reached the station their handoff plan asked for. A waiting reporter is not
   * counted as arrived until they move up to the front spot.
   */
  arrived(memberId: MemberId, station: string, now: number): void {
    if (memberId === "twob") {
      const brief = this.briefs[0];
      if (brief !== undefined && brief.arrivedAt === null && station === `visit-${brief.member}`) {
        brief.arrivedAt = now;
      }
      return;
    }
    const first = this.reports[0];
    if (first !== undefined && first.member === memberId && first.arrivedAt === null && station === "report-1") {
      first.arrivedAt = now;
    }
  }

  /** The member 2B is facing during a handoff, so each can turn to the other. */
  partnerOf(memberId: MemberId): MemberId | null {
    if (memberId === "twob") {
      const brief = this.briefs[0];
      if (brief?.arrivedAt != null) {
        return brief.member;
      }
      const report = this.reports[0];
      return report?.arrivedAt != null ? report.member : null;
    }
    const brief = this.briefs[0];
    if (brief?.member === memberId && brief.arrivedAt !== null) {
      return "twob";
    }
    const report = this.reports[0];
    return report?.member === memberId && report.arrivedAt !== null ? "twob" : null;
  }
}
