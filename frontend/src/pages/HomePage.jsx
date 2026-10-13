import Lottie from '../components/Lottie';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Leaf, Play, Sparkles, Star } from 'lucide-react';
import { useApp } from '../context/useApp';
import { activitySummary } from '../utils/activity';
import { moduleSummaries } from '../utils/moduleSummary';
import { burstConfetti } from '../utils/confetti';

const SINHALA_LETTERS = ['අ', 'ක', 'ම', 'ස', 'ළ', 'ග', 'ප', 'ත', 'ර', 'ල'];
const TAMIL_LETTERS = ['அ', 'க', 'ம', 'ச', 'ழ', 'த', 'ப', 'ர', 'ல', 'ந'];
// One animal perched on each module card.
const MODULE_PETS = ['monkey', 'dog', 'cat-mark', 'cat-box'];
const LETTER_TONES = ['orange', 'green', 'saffron', 'sky', 'leaf'];

export default function HomePage() {
  const navigate = useNavigate();
  const { history, grammarRuns, fluencyRuns, readingRuns, language, setLanguage, t } = useApp();
  const isTamil = language === 'tamil';

  // Progress bars start empty and fill once the page has painted.
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setFilled(true), 150);
    return () => clearTimeout(timer);
  }, []);

  const modules = moduleSummaries({ history, grammarRuns, fluencyRuns, readingRuns, language, t });

  const activity = useMemo(
    () => activitySummary([history, grammarRuns, fluencyRuns, readingRuns]),
    [history, grammarRuns, fluencyRuns, readingRuns],
  );
  const goalDone = activity.today >= activity.goal;

  function begin(event) {
    burstConfetti(event);
    setLanguage(language);
    navigate('/analyze');
  }

  // Letter bubbles around the logo: click to pop, a new letter floats back.
  const letters = isTamil ? TAMIL_LETTERS : SINHALA_LETTERS;
  const [bubbles, setBubbles] = useState(() => LETTER_TONES.map((_, index) => ({ letter: letters[index], popped: false })));
  useEffect(() => {
    setBubbles(LETTER_TONES.map((_, index) => ({ letter: letters[index], popped: false })));
  }, [letters]);
  function popLetter(event, index) {
    if (bubbles[index].popped) return;
    burstConfetti(event, 14);
    setBubbles((current) => current.map((bubble, i) => (i === index ? { ...bubble, popped: true } : bubble)));
    setTimeout(() => {
      setBubbles((current) => current.map((bubble, i) => (
        i === index ? { letter: letters[Math.floor(Math.random() * letters.length)], popped: false } : bubble
      )));
    }, 700);
  }

  function openModule(event, to) {
    burstConfetti(event);
    navigate(to);
  }

  return (
    <div className="kid-home">
      <section className="kid-hero">
        <div className="kid-hero-copy">
          <span className="kid-hero-tag"><Sparkles size={16} />{t('home.badge')}</span>
          <h1>{t('home.title')}</h1>
          <p>{t('home.heroText')}</p>
          <div className="kid-goal">
            <span className="kid-goal-label">{goalDone ? t('home.goalDone') : t('home.goalToday')}</span>
            <span className="kid-goal-stars">
              {Array.from({ length: activity.goal }, (_, index) => (
                <span key={index} className={`kid-goal-star ${index < activity.today ? 'earned' : ''}`} style={{ animationDelay: `${0.3 + index * 0.15}s` }}>
                  <Star size={22} fill={index < activity.today ? 'currentColor' : 'none'} />
                </span>
              ))}
            </span>
          </div>
          <div className="kid-hero-actions">
            <button className="chunky-btn orange" onClick={begin}><Play size={18} />{t('home.start')}</button>
            <button className="chunky-btn white" onClick={() => navigate('/practice')}><BookOpen size={18} />{t('home.practice')}</button>
          </div>
        </div>
        <div className="kid-hero-play">
          <div className="kid-hero-bubble" aria-hidden="true">
            <Leaf className="kid-leaf one" size={22} />
            <Leaf className="kid-leaf two" size={22} />
            <Lottie name="tree" className="hero-tree" />
            <Lottie name="tiger" className="hero-tiger" />
            <Lottie name="lurking-cat" className="hero-lurk" />
          </div>
          {bubbles.map((bubble, index) => (
            <button
              key={index}
              type="button"
              className={`kid-letter tone-${LETTER_TONES[index]} spot-${index} ${bubble.popped ? 'popped' : ''}`}
              aria-label={bubble.letter}
              onClick={(event) => popLetter(event, index)}
            >
              {bubble.letter}
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="kid-section-head"><h2>{t('home.learn')}</h2></div>
        <div className="kid-modules">
          {modules.map(({ to, tone, icon: Icon, title, text, fill, level }, index) => (
            <button key={to} className={`kid-module tone-${tone}`} onClick={(event) => openModule(event, to)}>
              <Lottie name={MODULE_PETS[index % MODULE_PETS.length]} className={`module-pet pet-${MODULE_PETS[index % MODULE_PETS.length]}`} />
              <span className="kid-module-head">
                <span className="kid-module-icon"><Icon size={28} /></span>
                <span className="kid-module-title">{title}</span>
              </span>
              <p>{text}</p>
              <span className="kid-module-foot">
                <span className="kid-module-bar"><i style={{ width: filled ? `${fill}%` : 0 }} /></span>
                <span className="kid-module-level">{level}</span>
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
