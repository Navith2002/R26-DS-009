import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '../context/FluencyLanguageContext'

// Shared MediaRecorder wrapper used by both the standard sentence-reading
// flow (RecordStage) and the custom-sentence flow (CustomStage). Mirrors
// the recording lifecycle that used to live inline in RecordStage:
// idle -> requesting -> recording -> recorded (or error).
export function useAudioRecorder() {
  const { t } = useLanguage()
  const [status, setStatus] = useState('idle') // idle | requesting | recording | recorded | error
  const [seconds, setSeconds] = useState(0)
  const [audioUrl, setAudioUrl] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const blobRef = useRef(null)
  const timerRef = useRef(null)
  const streamRef = useRef(null)

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      if (audioUrl) URL.revokeObjectURL(audioUrl)
    }
    // cleanup only on unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function start() {
    setErrorMsg('')
    setStatus('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const recorder = new MediaRecorder(stream)
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType })
        blobRef.current = blob
        setAudioUrl(URL.createObjectURL(blob))
        setStatus('recorded')
        stream.getTracks().forEach((t) => t.stop())
      }

      mediaRecorderRef.current = recorder
      recorder.start()
      setStatus('recording')
      setSeconds(0)
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000)
    } catch {
      setErrorMsg(t('common.micBlocked'))
      setStatus('error')
    }
  }

  function stop() {
    clearInterval(timerRef.current)
    mediaRecorderRef.current?.stop()
  }

  function reset() {
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioUrl(null)
    blobRef.current = null
    setSeconds(0)
    setStatus('idle')
  }

  return {
    status,
    seconds,
    audioUrl,
    errorMsg,
    getBlob: () => blobRef.current,
    start,
    stop,
    reset,
  }
}