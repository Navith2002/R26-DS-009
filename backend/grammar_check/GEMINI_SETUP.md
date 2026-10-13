Grammar checking uses `GEMINI_API_KEY` in the backend configuration. Restart
the backend after changing configuration; saved history keeps its original
result, so upload again to run a new check.

Optionally set `GEMINI_MODEL` to a model available to your Google AI Studio
project. The default remains `gemini-3.6-flash`; this change does not establish
that the model is available to every project. Spelling correction and both
Sinhala and Tamil grammar checks use the same configured model.

Temporary HTTP errors (429, 500, 502, 503, 504) receive at most two retries,
after one and two seconds. Invalid credentials and model/configuration errors
are not retried. Persistent failures remain failures in the report. A 503
response can still require waiting for the provider or choosing an available
model; replacing the API key alone does not resolve service availability.

`/grammar/health` reporting `llm_ready: true` only confirms that a key is
configured, not that a request to Google has succeeded.
