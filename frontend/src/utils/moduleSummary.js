import { Camera, Mic, SpellCheck2, Volume2 } from 'lucide-react';
import { formatDate, isAcceptedQualityResult, qualityLabel, qualityTone } from './format';
import { qualityLabelText } from '../i18n/translations';
import { latestByDate } from './activity';

// Writing-quality tone -> how full the area's progress bar is.
const TONE_FILL = { good: 85, average: 60, 'below-average': 40, poor: 20 };
const FLUENCY_FILL = { Fluent: 90, Struggling: 30 };

export function fluencyText(label, isTamil) {
  if (label === 'Fluent') return isTamil ? 'சரளம்' : 'ප්‍රවීණයි';
  if (label === 'Struggling') return isTamil ? 'பயிற்சி தேவை' : 'අභ්‍යාස අවශ්‍යයි';
  return isTamil ? 'மிதமானது' : 'මධ්‍යස්ථයි';
}

// One summary per learning area (latest level, how full its bar is, when
// it was last done), shared by the Home and Progress pages.
export function moduleSummaries({ history, grammarRuns, fluencyRuns, readingRuns, language, t }) {
  const isTamil = language === 'tamil';
  const latestWriting = history.filter(isAcceptedQualityResult)[0] || null;
  const writingLabel = latestWriting ? qualityLabel(latestWriting) : null;
  const latestGrammar = latestByDate(grammarRuns);
  const grammarAccuracy = latestGrammar && latestGrammar.total > 0
    ? Math.round((latestGrammar.correct / latestGrammar.total) * 100)
    : null;
  const latestFluency = latestByDate(fluencyRuns);
  const fluencyLabel = latestFluency?.result?.fluency_label;
  const latestReading = latestByDate(readingRuns);
  const readingAccuracy = latestReading ? Math.round(Number(latestReading.result?.accuracy || 0)) : null;
  const when = (item) => (item ? formatDate(item.createdAt, language) : '');

  return [
    {
      to: '/analyze', tone: 'orange', icon: Camera, title: t('nav.check'), text: t('home.descCheck'),
      fill: writingLabel ? TONE_FILL[qualityTone(writingLabel)] || 50 : 0,
      level: writingLabel ? qualityLabelText(writingLabel, language) : t('home.new'),
      date: when(latestWriting), count: history.length,
    },
    {
      to: '/grammar-check', tone: 'green', icon: SpellCheck2, title: t('nav.grammarCheck'), text: t('home.descGrammar'),
      fill: grammarAccuracy ?? 0,
      level: grammarAccuracy !== null ? `${grammarAccuracy}%` : t('home.new'),
      date: when(latestGrammar), count: grammarRuns.length, accuracy: grammarAccuracy,
    },
    {
      to: '/fluency', tone: 'saffron', icon: Mic, title: t('nav.fluency'), text: t('home.descFluency'),
      fill: latestFluency ? FLUENCY_FILL[fluencyLabel] || 60 : 0,
      level: latestFluency ? fluencyText(fluencyLabel, isTamil) : t('home.new'),
      date: when(latestFluency), count: fluencyRuns.length,
    },
    {
      to: '/reading-error', tone: 'sky', icon: Volume2, title: t('nav.readingError'), text: t('home.descReading'),
      fill: readingAccuracy ?? 0,
      level: readingAccuracy !== null ? `${readingAccuracy}%` : t('home.new'),
      date: when(latestReading), count: readingRuns.length,
    },
  ];
}
