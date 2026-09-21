/** Returns today's date as YYYY-MM-DD in the user's local timezone. */
export function getLocalToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

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
 * Returns true if a lesson has already happened -- i.e. its scheduled_date is
 * before today, or it's today and end_time (if set) has already passed.
 * Shared between LessonsPage (progresso geral) and AnalyticsPage (contagem
 * de "aulas realizadas"), pra não ter duas lógicas diferentes de "aula já
 * aconteceu" no sistema.
 */
export function lessonHasPassed(lesson: { scheduled_date?: string | null; end_time?: string | null }): boolean {
  if (!lesson.scheduled_date) return false;
  const today = getLocalToday();
  const lessonDate = lesson.scheduled_date;

  if (lessonDate > today) return false;
  if (lessonDate < today) return true;

  // Mesmo dia: verifica end_time
  if (lesson.end_time) {
    const now = new Date();
    const [h, m] = lesson.end_time.split(':').map(Number);
    const endMins = h * 60 + m;
    const nowMins = now.getHours() * 60 + now.getMinutes();
    return nowMins > endMins;
  }

  // Sem end_time: considera passada após o dia (já sabemos que lessonDate === today aqui)
  return false;
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
