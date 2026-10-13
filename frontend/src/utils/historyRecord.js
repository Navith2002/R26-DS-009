// Photos, audio and server-local output URLs are transient. Store durable report
// text and measurements; large embedded photos do not fit Firestore documents.
const transientKeys = new Set(['line_img', 'output_files', 'audioUrl', 'preview', 'image_base64']);
export function durableReport(value) {
  return JSON.parse(JSON.stringify(value, (key, item) => {
    if (transientKeys.has(key) || (typeof item === 'string' && /^(data:|blob:)/.test(item))) return undefined;
    return item;
  }));
}
export function encodeHistory(entry) {
  const payload = JSON.stringify(durableReport(entry));
  if (new TextEncoder().encode(payload).length > 800_000) {
    const error = new Error('history-too-large');
    error.code = 'history-too-large';
    throw error;
  }
  return payload;
}
export function partitionHistory(records) {
  const sorted = [...records].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return {
    history: sorted.filter((item) => item.kind === 'handwriting'),
    grammarRuns: sorted.filter((item) => item.kind === 'grammar').reverse(),
    fluencyRuns: sorted.filter((item) => item.kind === 'fluency').reverse(),
    readingRuns: sorted.filter((item) => item.kind === 'reading'),
  };
}
