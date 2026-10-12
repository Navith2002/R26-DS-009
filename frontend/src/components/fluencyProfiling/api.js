// Reading-fluency-profiling component. Originally its own FastAPI process
// on its own port; now mounted as a sub-app (see backend/fluency_router.py)
// on the same app/port as the other components (see ../../services/api.js),
// under the /fluency prefix. Same pattern as grammarApi.js's
// GRAMMAR_API_BASE_URL.
const BASE_URL = `${(import.meta.env.VITE_FLUENCY_API_BASE_URL || import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')}/fluency`

async function handleResponse(res) {
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = body.detail || detail
    } catch {
      // response wasn't JSON — fall back to statusText
    }
    throw new Error(detail)
  }
  return res.json()
}

export async function fetchSentences() {
  const res = await fetch(`${BASE_URL}/sentences`)
  return handleResponse(res)
}

export async function fetchClusters() {
  const res = await fetch(`${BASE_URL}/clusters`)
  return handleResponse(res)
}

export async function fetchActivities() {
  const res = await fetch(`${BASE_URL}/activities`)
  return handleResponse(res)
}

export async function fetchProfile(studentId) {
  const res = await fetch(`${BASE_URL}/profile/${encodeURIComponent(studentId)}`)
  return handleResponse(res)
}

// Wraps the recorded browser audio (webm/ogg, whatever MediaRecorder produced)
// in a file named "recording.wav" so FastAPI's filename check passes.
// librosa.load() on the server decodes the real container via its audioread/
// ffmpeg fallback, so the actual encoding doesn't need to be WAV — but ffmpeg
// must be installed and on PATH on the machine running the backend.
function toWavNamedFile(audioBlob) {
  return new File([audioBlob], 'recording.wav', {
    type: audioBlob.type || 'audio/wav',
  })
}

export async function submitAssessment({ audioBlob, sentenceId, studentId }) {
  const form = new FormData()
  form.append('audio', toWavNamedFile(audioBlob))
  form.append('sentence_id', sentenceId)
  form.append('student_id', studentId || '')

  const res = await fetch(`${BASE_URL}/assess`, {
    method: 'POST',
    body: form,
  })
  return handleResponse(res)
}

export async function submitCustomAssessment({ audioBlob, groundTruth, studentId }) {
  const form = new FormData()
  form.append('audio', toWavNamedFile(audioBlob))
  form.append('ground_truth', groundTruth)
  form.append('student_id', studentId || '')

  const res = await fetch(`${BASE_URL}/assess/custom`, {
    method: 'POST',
    body: form,
  })
  return handleResponse(res)
}