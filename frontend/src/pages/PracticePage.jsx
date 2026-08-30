import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Image as ImageIcon,
  Languages,
  PenLine,
  Printer,
  Rows3,
  Sparkles,
  Type,
} from 'lucide-react';
import { useApp } from '../context/useApp';
import { localizedSkill } from '../i18n/translations';

import mangoImg from '../assets/picture-mango.svg';
import flowerImg from '../assets/picture-flower.svg';
import fishImg from '../assets/picture-fish.svg';
import houseImg from '../assets/picture-house.svg';
import bookImg from '../assets/picture-book.svg';
import sunImg from '../assets/picture-sun.svg';

const pictureItems = [
  {
    image: mangoImg,
    key: 'mango',
    sinhala: 'අඹ',
    tamil: 'மாம்பழம்',
    label: 'Mango',
  },
  {
    image: flowerImg,
    key: 'flower',
    sinhala: 'මල',
    tamil: 'மலர்',
    label: 'Flower',
  },
  {
    image: fishImg,
    key: 'fish',
    sinhala: 'මාළුවා',
    tamil: 'மீன்',
    label: 'Fish',
  },
  {
    image: houseImg,
    key: 'house',
    sinhala: 'නිවස',
    tamil: 'வீடு',
    label: 'House',
  },
  {
    image: bookImg,
    key: 'book',
    sinhala: 'පොත',
    tamil: 'புத்தகம்',
    label: 'Book',
  },
  {
    image: sunImg,
    key: 'sun',
    sinhala: 'හිරු',
    tamil: 'சூரியன்',
    label: 'Sun',
  },
];

const languageContent = {
  sinhala: {
    scriptName: 'සිංහල',

    words: [
      'පාසල',
      'පොත',
      'යහළුවා',
      'ගෙදර',
      'මල',
      'අම්මා',
    ],

    sentences: [
      'මම පාසලට යමි.',
      'මම පොතක් කියවමි.',
      'අපි එකට සෙල්ලම් කරමු.',
      'අම්මා මට කතාවක් කියයි.',
    ],

    paragraphs: [
      'අපේ පාසල ලස්සනයි. අපි පාසලේ සතුටින් ඉගෙන ගනිමු. මම මගේ යහළුවන් සමඟ සෙල්ලම් කරමි.',
      'මම සෑම දිනකම පොතක් කියවමි. අලුත් වචන ඉගෙන ගැනීමට මම කැමතියි. ලස්සන අකුරු ලියන්නත් මම පුහුණු වෙමි.',
    ],
  },

  tamil: {
    scriptName: 'தமிழ்',

    words: [
      'பள்ளி',
      'புத்தகம்',
      'நண்பன்',
      'வீடு',
      'மலர்',
      'அம்மா',
    ],

    sentences: [
      'நான் பள்ளிக்குச் செல்கிறேன்.',
      'நான் ஒரு புத்தகம் படிக்கிறேன்.',
      'நாங்கள் ஒன்றாக விளையாடுகிறோம்.',
      'அம்மா எனக்கு ஒரு கதை சொல்கிறார்.',
    ],

    paragraphs: [
      'எங்கள் பள்ளி அழகானது. நாங்கள் பள்ளியில் மகிழ்ச்சியாக கற்கிறோம். நான் என் நண்பர்களுடன் விளையாடுகிறேன்.',
      'நான் தினமும் ஒரு புத்தகம் படிக்கிறேன். புதிய சொற்களை கற்க எனக்கு பிடிக்கும். அழகாக எழுதவும் நான் பயிற்சி செய்கிறேன்.',
    ],
  },
};

const skillIcons = {
  spacing: '↔️',
  word_spacing: '↔️',
  character_spacing: '🔤',
  baseline_alignment: '📏',
  local_baseline_drift: '📏',
  size_variation: '📦',
  character_proportion: '⬜',
  character_proportion_variation: '⬜',
  curve_smoothness: '〰️',
  loop_roundness: '⭕',
  stroke_continuity: '✍️',
  character_shape: '👀',
  character_shape_consistency: '👀',
  upper_lower_balance: '⚖️',
  slant: '📐',
  stroke_thickness: '🖊️',
  stroke_thickness_consistency: '🖊️',
  density_distribution: '✨',
  general: '🌟',
};

export default function PracticePage() {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    language,
    setLanguage,
    t,
  } = useApp();

  const requestedLanguage = location.state?.language;
  const focus = location.state?.focus || 'general';

  useEffect(() => {
    if (
      (requestedLanguage === 'tamil' ||
        requestedLanguage === 'sinhala') &&
      requestedLanguage !== language
    ) {
      setLanguage(requestedLanguage);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [tab, setTab] = useState('pictures');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const content = languageContent[language];
  const skill = localizedSkill(focus, language);

  const skillIcon =
    skillIcons[focus] ||
    skillIcons.general;

  const activePrompt = useMemo(() => {
    if (tab === 'pictures') {
      return pictureItems[selectedIndex]?.[language] || '';
    }

    if (tab === 'words') {
      return content.words[
        selectedIndex % content.words.length
      ];
    }

    if (tab === 'sentences') {
      return content.sentences[
        selectedIndex % content.sentences.length
      ];
    }

    return content.paragraphs[
      selectedIndex % content.paragraphs.length
    ];
  }, [
    tab,
    selectedIndex,
    content,
    language,
  ]);

  const printLabel =
    language === 'tamil'
      ? 'அச்சிடு'
      : 'මුද්‍රණය';

  function changeLanguage(next) {
    setLanguage(next);
    setSelectedIndex(0);
  }

  function chooseTab(next) {
    setTab(next);
    setSelectedIndex(0);
  }

  function handlePrint() {
    window.print();
  }

  const tabs = [
    {
      id: 'pictures',
      label: t('practice.pictureWrite'),
      icon: ImageIcon,
    },
    {
      id: 'words',
      label: t('practice.words'),
      icon: Type,
    },
    {
      id: 'sentences',
      label: t('practice.sentences'),
      icon: PenLine,
    },
    {
      id: 'paragraphs',
      label: t('practice.paragraphs'),
      icon: BookOpen,
    },
  ];

  const optionCount =
    tab === 'pictures'
      ? pictureItems.length
      : tab === 'words'
        ? content.words.length
        : tab === 'sentences'
          ? content.sentences.length
          : content.paragraphs.length;

  return (
    <>
      {/* Print only the selected practice card */}
      <style>
        {`
          @media print {

            @page {
              size: A4 portrait;
              margin: 12mm;
            }

            body {
              background: #ffffff !important;
              margin: 0 !important;
            }

            body * {
              visibility: hidden !important;
            }

            #practice-print-card,
            #practice-print-card * {
              visibility: visible !important;
            }

            #practice-print-card {
              position: absolute !important;
              top: 0 !important;
              left: 0 !important;

              width: 100% !important;
              max-width: none !important;

              margin: 0 !important;
              padding: 20px !important;

              border: none !important;
              border-radius: 0 !important;
              box-shadow: none !important;

              background: #ffffff !important;
            }

            #practice-print-card .practice-print-actions {
              display: none !important;
            }

            #practice-print-card .practice-paper-footer button {
              display: none !important;
            }

            #practice-print-card .writing-sheet {
              break-inside: avoid !important;
              page-break-inside: avoid !important;
            }

            #practice-print-card .practice-example-picture {
              break-inside: avoid !important;
              page-break-inside: avoid !important;
            }

            #practice-print-card .practice-prompt {
              break-inside: avoid !important;
              page-break-inside: avoid !important;
            }
          }
        `}
      </style>

      <div className="page-stack practice-page-kids">

        {/* Page header */}
        <section className="page-intro practice-intro">
          <div>
            <span className="eyebrow">
              {t('practice.eyebrow')}
            </span>

            <h2>
              {t('practice.title')}
            </h2>
          </div>

          <div
            className="practice-language-switch"
            aria-label={t('practice.languageLabel')}
          >
            <Languages size={18} />

            <button
              type="button"
              className={
                language === 'sinhala'
                  ? 'active'
                  : ''
              }
              onClick={() =>
                changeLanguage('sinhala')
              }
            >
              සිංහල
            </button>

            <button
              type="button"
              className={
                language === 'tamil'
                  ? 'active'
                  : ''
              }
              onClick={() =>
                changeLanguage('tamil')
              }
            >
              தமிழ்
            </button>
          </div>
        </section>

        {/* Practice focus */}
        <section className="focus-practice-card">
          <div className="focus-practice-icon">
            {skillIcon}
          </div>

          <div>
            <span className="eyebrow">
              {t('practice.focus')}
            </span>

            <h3>
              {skill.title}
            </h3>

            <p>
              {skill.instruction}
            </p>
          </div>

          <Sparkles size={24} />
        </section>

        {/* Practice types */}
        <div className="practice-tabs">
          {tabs.map(
            ({
              id,
              label,
              icon: Icon,
            }) => (
              <button
                type="button"
                key={id}
                className={
                  tab === id
                    ? 'active'
                    : ''
                }
                onClick={() =>
                  chooseTab(id)
                }
              >
                <Icon size={18} />
                <span>{label}</span>
              </button>
            )
          )}
        </div>

        <section className="practice-workspace">

          {/* Left selection panel */}
          <div className="practice-picker-panel">

            <div className="card-heading-row">
              <div>
                <span className="eyebrow">
                  {t('practice.chooseOne')}
                </span>

                <h3>
                  {content.scriptName}{' '}
                  {t('practice.practiceSuffix')}
                </h3>
              </div>
            </div>

            {tab === 'pictures' ? (
              <div className="picture-choice-grid">

                {pictureItems.map(
                  (item, index) => (
                    <button
                      type="button"
                      key={item.key}
                      className={
                        selectedIndex === index
                          ? 'active'
                          : ''
                      }
                      onClick={() =>
                        setSelectedIndex(index)
                      }
                    >
                      <img
                        src={item.image}
                        alt={item.label}
                      />

                      <strong>
                        {item[language]}
                      </strong>
                    </button>
                  )
                )}

              </div>
            ) : (
              <div className="text-choice-list">

                {Array.from({
                  length: optionCount,
                }).map((_, index) => {

                  const value =
                    tab === 'words'
                      ? content.words[index]
                      : tab === 'sentences'
                        ? content.sentences[index]
                        : content.paragraphs[index];

                  return (
                    <button
                      type="button"
                      key={`${tab}-${index}`}
                      className={
                        selectedIndex === index
                          ? 'active'
                          : ''
                      }
                      onClick={() =>
                        setSelectedIndex(index)
                      }
                    >
                      <span>
                        {index + 1}
                      </span>

                      <strong>
                        {value}
                      </strong>
                    </button>
                  );
                })}

              </div>
            )}
          </div>

          {/* Printable practice card */}
          <div
            className="practice-paper-card"
            id="practice-print-card"
          >

            <div className="practice-paper-heading">

              <div className="practice-paper-icon">
                <Rows3 size={20} />
              </div>

              <div>
                <span>
                  {t('practice.lookExample')}
                </span>

                <h3>
                  {t('practice.copyCarefully')}
                </h3>
              </div>

              {/* Print button */}
              <div
                className="practice-print-actions"
                style={{
                  marginLeft: 'auto',
                }}
              >
                <button
                  type="button"
                  onClick={handlePrint}
                  aria-label={printLabel}
                  title={printLabel}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    padding: '9px 14px',
                    borderRadius: '10px',
                    border:
                      '1px solid #e6e8ec',
                    background: '#ffffff',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '14px',
                  }}
                >
                  <Printer size={17} />
                  {printLabel}
                </button>
              </div>

            </div>

            {/* Picture example */}
            {tab === 'pictures' && (
              <div className="practice-example-picture">
                <img
                  src={
                    pictureItems[selectedIndex]
                      ?.image
                  }
                  alt={
                    pictureItems[selectedIndex]
                      ?.label ||
                    t('practice.pictureAlt')
                  }
                />
              </div>
            )}

            {/* Selected word/sentence */}
            <div
              className={`practice-prompt ${
                tab === 'paragraphs'
                  ? 'paragraph'
                  : ''
              }`}
            >
              {activePrompt}
            </div>

            {/* Writing area */}
            <div
              className={`writing-sheet ${
                focus === 'size_variation' ||
                focus ===
                  'character_proportion' ||
                focus ===
                  'character_proportion_variation'
                  ? 'box-guides'
                  : ''
              }`}
            >
              {Array.from({
                length:
                  tab === 'paragraphs'
                    ? 7
                    : 5,
              }).map((_, index) => (
                <div
                  className="writing-line"
                  key={index}
                >
                  <span>
                    {index + 1}
                  </span>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="practice-paper-footer">

              <span>
                {t('practice.tip')}
              </span>

              <button
                type="button"
                className="practice-print-actions"
                onClick={() =>
                  navigate('/analyze')
                }
              >
                {t('practice.checkWriting')} →
              </button>

            </div>

          </div>
        </section>
      </div>
    </>
  );
}