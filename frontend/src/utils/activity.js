// Daily goal, streak and this-week tracker, derived from the child's saved
// activity (writing checks, grammar, fluency and reading runs). Days are
// local calendar days.

export const DAILY_GOAL = 3;

function dayKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function activitySummary(groups, now = new Date()) {
  const days = new Map();
  for (const item of groups.flat()) {
    const date = new Date(item?.createdAt);
    if (Number.isNaN(date.getTime())) continue;
    const key = dayKey(date);
    days.set(key, (days.get(key) || 0) + 1);
  }

  const today = days.get(dayKey(now)) || 0;
  let month = 0;
  for (const item of groups.flat()) {
    const date = new Date(item?.createdAt);
    if (date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()) month += 1;
  }

  // Streak counts back from today; if nothing yet today, from yesterday,
  // so the streak does not reset to 0 first thing in the morning.
  let streak = 0;
  const cursor = new Date(now);
  if (!today) cursor.setDate(cursor.getDate() - 1);
  while (days.get(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  // Monday-first week containing today.
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const week = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return { done: Boolean(days.get(dayKey(date))), isToday: dayKey(date) === dayKey(now), day: date.getDate() };
  });

  return { today, month, goal: DAILY_GOAL, streak, week };
}

export function latestByDate(items) {
  return items.reduce((latest, item) => (
    !latest || new Date(item.createdAt) > new Date(latest.createdAt) ? item : latest
  ), null);
}
