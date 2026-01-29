import { DateTime } from 'luxon';

/**
 * Builds UTC date from user-intended LOCAL time
 * using explicit Y/M/D (never server time)
 */
export function buildUserDateTimeToUTC(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timezone: string
): Date {
  return DateTime.fromObject(
    {
      year,
      month,
      day,
      hour,
      minute,
      second: 0,
      millisecond: 0
    },
    { zone: timezone }
  ).toUTC().toJSDate();
}
