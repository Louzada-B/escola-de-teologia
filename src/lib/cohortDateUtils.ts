/**
 * Returns true if `date` is within the cohort's active period:
 *   date >= cohort.start_date AND date <= MIN(today, cohort.end_date)
 *
 * If no cohort is provided, returns true (no filtering).
 */
export function isDateWithinCohortPeriod(
  date: string | null | undefined,
  cohortStartDate: string | undefined,
  effectiveCutoffDate: string,
): boolean {
  if (!date) return false;
  if (cohortStartDate && date < cohortStartDate) return false;
  if (date > effectiveCutoffDate) return false;
  return true;
}

/**
 * Returns true if `date` falls within the cohort's full period (start_date to end_date),
 * ignoring the "today" cutoff. Useful for calendars and upcoming events.
 */
export function isDateWithinCohortFullPeriod(
  date: string | null | undefined,
  cohortStartDate: string | undefined,
  cohortEndDate: string | undefined,
): boolean {
  if (!date) return false;
  if (cohortStartDate && date < cohortStartDate) return false;
  if (cohortEndDate && date > cohortEndDate) return false;
  return true;
}
