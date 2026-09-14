export async function scheduleDhikraReminder(input: { title: string; body: string; dateIso: string; memoryId?: number | null }) {
  const date = new Date(input.dateIso);
  if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
    throw new Error("Reminder date must be in the future.");
  }
  return `web-preview-${date.getTime()}`;
}
