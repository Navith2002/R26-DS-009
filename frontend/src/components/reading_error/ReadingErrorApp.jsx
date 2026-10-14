import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Mic, RotateCcw, SkipForward, Square } from "lucide-react";
import { useApp } from "../../context/useApp";
import { burstConfetti } from "../../utils/confetti";
import { predictReading } from "./api";
import ReadingReport from "./ReadingReport";
import {
  childTextFor, sinhalaQuestions, studentGuideFor, tamilQuestions, taskLabel,
} from "./readingText";

// Reading-error check: pick a word / sentence, read it aloud, get a report.
// Styled with the shared .gc / .fl system (bhasha.css); the app header's
// language toggle drives the language.
export default function ReadingErrorApp() {
  const { language: appLanguage, registerReadingRun, t: appT } = useApp();
  // This component's data and the backend use 'Sinhala' | 'Tamil'.
  const language = appLanguage === "tamil" ? "Tamil" : "Sinhala";
  const questions = language === "Tamil" ? tamilQuestions : sinhalaQuestions;
  const taskKeys = Object.keys(questions);
  const guide = studentGuideFor(language);
  const childText = childTextFor(language);

  const [selectedTask, setSelectedTask] = useState(taskKeys[0]);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [micError, setMicError] = useState("");

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const clapAudioRef = useRef(null);

  const expectedText = questions[selectedTask];
  const currentTaskIndex = Math.max(taskKeys.indexOf(selectedTask), 0);
  const progressPercent = ((currentTaskIndex + 1) / taskKeys.length) * 100;
  const isCorrectAnswer = result?.status === "success" && result.error_type === "Correct";

  // Applause: unlocked on the record click (browsers need a user gesture),
  // played when the reading is correct.
  function unlockClapSound() {
    try {
      if (!clapAudioRef.current) {
        clapAudioRef.current = new Audio("/sounds/applause.mp3");
        clapAudioRef.current.preload = "auto";
        clapAudioRef.current.volume = 0.8;
      }
      const audio = clapAudioRef.current;
      audio.muted = true;
      audio.currentTime = 0;
      audio.play().then(() => { audio.pause(); audio.currentTime = 0; audio.muted = false; }).catch(() => {});
    } catch {
      // Applause is a nice-to-have; ignore audio errors.
    }
  }

  useEffect(() => {
    if (!isCorrectAnswer) return;
    burstConfetti({ clientX: window.innerWidth / 2, clientY: window.innerHeight / 3 }, 40);
    const audio = clapAudioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audio.muted = false;
      audio.play().catch(() => {});
    }
  }, [isCorrectAnswer]);

  // Header language change: back to the first task of that language.
  useEffect(() => {
    setSelectedTask(Object.keys(language === "Tamil" ? tamilQuestions : sinhalaQuestions)[0]);
    setResult(null);
    setAudioUrl("");
  }, [language]);

  // Recording timer.
  useEffect(() => {
    if (!recording) return undefined;
    setSeconds(0);
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [recording]);

  function chooseTask(task) {
    setSelectedTask(task);
    setResult(null);
    setAudioUrl("");
    setMicError("");
  }

  function stepTask(delta) {
    chooseTask(taskKeys[(currentTaskIndex + delta + taskKeys.length) % taskKeys.length]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function startRecording() {
    unlockClapSound();
    setResult(null);
    setAudioUrl("");
    setMicError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioUrl(URL.createObjectURL(blob));
        predict(blob);
        stream.getTracks().forEach((track) => track.stop());
      };
      mediaRecorder.start();
      setRecording(true);
    } catch {
      setMicError(language === "Tamil" ? "மைக்ரோஃபோன் அனுமதி தேவை." : "මයික්‍රොෆෝන අවසරය අවශ්‍යයි.");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  }

  async function predict(blob) {
    setLoading(true);
    try {
      const data = await predictReading({ language, expectedText, audioBlob: blob });
      if (data?.status === "success") await registerReadingRun(data, appLanguage);
      setResult(data);
    } catch (error) {
      setResult({
        status: "error",
        message: appT(error.code === "history-too-large" ? "account.historyTooLarge" : error.code === "history-save-failed" ? "account.saveError" : "account.analysisError"),
      });
    } finally {
      setLoading(false);
    }
  }

  // Finished reading: the report, with "next" and "try again".
  if (result?.status === "success") {
    return (
      <ReadingReport
        result={result}
        language={language}
        actions={[
          { label: childText.next, icon: SkipForward, kind: "orange", onClick: () => stepTask(1) },
          { label: childText.retry, icon: RotateCcw, kind: "white", onClick: () => chooseTask(selectedTask) },
        ]}
      />
    );
  }

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="page-stack gc fl re">
      <section className="page-intro">
        <span className="eyebrow">{guide.appSubtitle}</span>
        <h2>{guide.appTitle}</h2>
      </section>

      {/* Task navigator */}
      <section className="gc-card re-nav">
        <button type="button" className="re-nav-step" onClick={() => stepTask(-1)} aria-label="previous"><ArrowLeft size={18} /></button>
        <div className="re-nav-body">
          <label className="re-nav-select">
            <span className="gc-muted">{guide.chooseTask}</span>
            <select value={selectedTask} onChange={(e) => chooseTask(e.target.value)} disabled={recording || loading}>
              {taskKeys.map((task) => <option key={task} value={task}>{taskLabel(task, language)}</option>)}
            </select>
          </label>
          <div className="re-nav-progress">
            <span className="gc-muted">{childText.activity} {currentTaskIndex + 1} / {taskKeys.length}</span>
            <span className="re-progress"><i style={{ width: `${progressPercent}%` }} /></span>
          </div>
        </div>
        <button type="button" className="re-nav-step" onClick={() => stepTask(1)} aria-label="next"><ArrowRight size={18} /></button>
      </section>

      {/* Text to read */}
      <section className={`fl-reading re-reading ${recording ? "live" : ""}`}>
        <span className="fl-reading-tag">{guide.readTitle}</span>
        <p className="fl-reading-text">{expectedText}</p>
      </section>

      {/* Record */}
      <section className="gc-card fl-recorder">
        {!loading ? (
          <div className="fl-mic-area">
            <button
              type="button"
              className={`fl-mic ${recording ? "live" : ""}`}
              onClick={recording ? stopRecording : startRecording}
              aria-label={recording ? guide.stopBtn : guide.startBtn}
            >
              <span className="fl-mic-ring one" aria-hidden="true" />
              <span className="fl-mic-ring two" aria-hidden="true" />
              <span className="fl-mic-core">{recording ? <Square size={30} fill="currentColor" /> : <Mic size={36} />}</span>
            </button>
            <span className="fl-mic-label">{recording ? guide.stopBtn : guide.startBtn}</span>
            {recording ? (
              <span className="fl-timer" aria-live="polite">
                <i className="fl-live-dot" aria-hidden="true" />{mm}:{ss}
                <span className="fl-wave" aria-hidden="true">{[0, 1, 2, 3, 4, 5, 6].map((i) => <b key={i} style={{ animationDelay: `${i * 0.09}s` }} />)}</span>
              </span>
            ) : (
              <span className="gc-muted">{childText.ready}</span>
            )}
            {micError && <p className="fl-error">{micError}</p>}
            {result?.status === "error" && <div className="error-banner" role="alert">{result.message || appT("account.analysisError")}</div>}
          </div>
        ) : (
          <div className="re-analyzing" role="status">
            <span className="re-analyzing-wave" aria-hidden="true">{[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => <b key={i} style={{ animationDelay: `${i * 0.08}s` }} />)}</span>
            <strong>{guide.analyzingText}</strong>
            <span className="gc-muted">{childText.thinking}</span>
          </div>
        )}
        {audioUrl && !recording && (
          <div className="fl-audio re-audio">
            <span className="gc-muted">{guide.audioText}</span>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio controls src={audioUrl} />
          </div>
        )}
      </section>
    </div>
  );
}
