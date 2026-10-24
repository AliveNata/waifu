/**
 * The office runs on Jakarta time, whatever the PC's own time zone: the wall clock, day and
 * night, what people say and what they feel like doing all read the same hour. Indonesia has no
 * daylight saving, so Jakarta is always seven hours ahead of UTC and needs no time zone database.
 */
export const officeTimeZone = "Asia/Jakarta";
const jakartaOffsetHours = 7;

export interface ClockTime {
  hours: number;
  minutes: number;
  seconds: number;
}

export function jakartaTime(date: Date): ClockTime {
  return {
    hours: (date.getUTCHours() + jakartaOffsetHours) % 24,
    minutes: date.getUTCMinutes(),
    seconds: date.getUTCSeconds(),
  };
}

/** Hours since Jakarta midnight, with the minutes and seconds as a fraction. */
export function jakartaHours(date: Date): number {
  const { hours, minutes, seconds } = jakartaTime(date);
  return hours + minutes / 60 + seconds / 3600;
}

/** The moment today (by UTC date) when Jakarta reads `hours:minutes`, for previewing a time of day. */
export function atJakartaTime(hours: number, minutes: number, from: Date = new Date()): Date {
  const date = new Date(from);
  date.setUTCHours((hours - jakartaOffsetHours + 24) % 24, minutes, 0, 0);
  return date;
}

/** Parts of the day as people in the office would greet each other. */
export type DayPart = "pagi" | "siang" | "sore" | "malam";

export function dayPart(hours: number): DayPart {
  if (hours >= 4 && hours < 11) {
    return "pagi";
  }
  if (hours >= 11 && hours < 15) {
    return "siang";
  }
  if (hours >= 15 && hours < 18) {
    return "sore";
  }
  return "malam";
}

/** "08:05", with the colon left out on odd seconds so the wall clock blinks. */
export function clockFace(time: ClockTime, blink: boolean): string {
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${pad(time.hours)}${blink && time.seconds % 2 === 1 ? " " : ":"}${pad(time.minutes)}`;
}

/**
 * How the sky looks: `night` 0 in full day to 1 at night, eased through dawn (05:00 to 06:30) and
 * dusk (17:30 to 19:00); `twilight` peaks halfway through either, for the orange and pink.
 */
export function skyAt(hours: number): { night: number; twilight: number } {
  const ramp = (from: number, to: number): number => {
    const t = Math.min(1, Math.max(0, (hours - from) / (to - from)));
    return t * t * (3 - 2 * t);
  };
  const night = hours >= 12 ? ramp(17.5, 19) : 1 - ramp(5, 6.5);
  return { night, twilight: Math.sin(Math.PI * night) };
}
