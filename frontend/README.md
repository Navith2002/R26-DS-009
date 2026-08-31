# WriteBright — Kid-Friendly Frontend

This frontend is aligned with the audited handwriting backend.

## What changed

- Child-facing wording: no model/backend jargon in the normal UI.
- Quality classes use distinct colors:
  - Very Good / Good = green
  - Average = yellow
  - Below Average = orange
  - Poor = red
  - Needs Teacher Review = purple
- No fabricated 0–100 handwriting score.
- Low-confidence results show **Let’s Ask a Teacher** instead of accepting a final class.
- Input/segmentation failures show **retake photo** guidance, not a handwriting-quality judgment.
- Only the top three improvement priorities are shown to the child.
- Teacher/research details are collapsed under a separate details panel.
- Practice section includes:
  - Picture & Write
  - Sinhala/Tamil words
  - Sinhala/Tamil sentences
  - short Sinhala/Tamil paragraphs
- Home page includes cartoon SVG illustrations and a friendly pencil mascot.
- Progress history is stored locally in the browser and excludes retake/segmentation failures.

## Connect to backend

Copy `.env.example` to `.env`:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

## Run

```powershell
npm install
npm run dev
```

Open:

`http://localhost:5173`

Backend should run on:

`http://127.0.0.1:8000`

## Backend response states handled

- `COMPLETED`
- `NEEDS_TEACHER_REVIEW`
- `INPUT_RETAKE_REQUIRED`
- `SEGMENTATION_UNRELIABLE`
- `MODEL_ERROR`

## Note about your previous frontend

The current React source bundle was not present in the supplied files, so this package is a clean replacement frontend built against the latest audited API contract. You can copy these `src/` and `public/` folders into your existing `writebright-react` project, or run it as a fresh Vite app.
