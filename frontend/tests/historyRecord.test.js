import { describe, it, expect } from 'vitest';
import { durableReport, encodeHistory, partitionHistory } from '../src/utils/historyRecord';
import { privacyTranslations } from '../src/i18n/privacyTranslations';
import { accountTranslations } from '../src/i18n/accountTranslations';
import { localizedActivity } from '../src/i18n/fluencyActivities';
import { translate } from '../src/i18n/translations';

describe('durable child reports', () => {
  it('keeps report text, arrays and measurements while removing transient media', () => {
    const report = { result: { lines: [{ text: 'අම්මා', line_img: 'huge-base64', confidence: 0.9 }], vectors: [[1, 2], [3, 4]] }, output_files: { image: '/outputs/x.png' }, preview: 'blob:private', language: 'sinhala' };
    const saved = JSON.parse(encodeHistory(report));
    expect(saved.result.lines).toEqual([{ text: 'අම්මා', confidence: 0.9 }]);
    expect(saved.result.vectors).toEqual([[1, 2], [3, 4]]);
    expect(saved).not.toHaveProperty('output_files');
    expect(saved).not.toHaveProperty('preview');
    expect(report.result.lines[0].line_img).toBe('huge-base64');
  });
  it('rejects an oversized UTF-8 report rather than claiming it was saved', () => {
    expect(() => encodeHistory({ text: 'අ'.repeat(300000) })).toThrow('history-too-large');
  });
  it('partitions all four history types in the order existing progress pages expect', () => {
    const saved = ['handwriting', 'grammar', 'fluency', 'reading'].flatMap((kind) => [
      { id: `${kind}-old`, kind, createdAt: '2026-01-01' },
      { id: `${kind}-new`, kind, createdAt: '2026-02-01' },
    ]);
    const grouped = partitionHistory(saved);
    expect(grouped.history[0].id).toBe('handwriting-new');
    expect(grouped.grammarRuns.at(-1).id).toBe('grammar-new');
    expect(grouped.fluencyRuns.at(-1).id).toBe('fluency-new');
    expect(grouped.readingRuns[0].id).toBe('reading-new');
  });
});

describe('Sinhala and Tamil accounts', () => {
  it('has matching account keys with native-language text and interpolated child names', () => {
    expect(Object.keys(accountTranslations.tamil).sort()).toEqual(Object.keys(accountTranslations.sinhala).sort());
    for (const [language, messages] of Object.entries(accountTranslations)) {
      const script = language === 'tamil' ? /[\u0B80-\u0BFF]/ : /[\u0D80-\u0DFF]/;
      for (const message of Object.values(messages)) expect(script.test(message)).toBe(true);
      expect(translate(language, 'account.currentChild', { name: 'TEST_CHILD' })).toContain('TEST_CHILD');
    }
  });
});

it('localizes every current assessment activity in Sinhala and Tamil without English fallbacks', () => {
  for (const language of ['sinhala', 'tamil']) {
    const script = language === 'tamil' ? /[\u0B80-\u0BFF]/ : /[\u0D80-\u0DFF]/;
    for (let id = 1; id <= 25; id += 1) {
      const activity = localizedActivity({ act_id: `ACT${String(id).padStart(3, '0')}`, target_skill: 'Fluency' }, language);
      expect(script.test(activity.name)).toBe(true);
      expect(activity.name).not.toMatch(/[a-zA-Z]/);
      expect(script.test(activity.description)).toBe(true);
    }
  }
});

it('provides privacy notes and parent acknowledgement in both native scripts', () => {
  expect(Object.keys(privacyTranslations.tamil).sort()).toEqual(Object.keys(privacyTranslations.sinhala).sort());
  for (const [language, messages] of Object.entries(privacyTranslations)) {
    const script = language === 'tamil' ? /[\u0B80-\u0BFF]/ : /[\u0D80-\u0DFF]/;
    for (const message of Object.values(messages)) expect(script.test(message)).toBe(true);
    expect(translate(language, 'privacy.accept')).toBe(messages['privacy.accept']);
  }
});
