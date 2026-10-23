# AI Classroom · Fire TV showcase MVP

A 2–3 minute demo of one loop: **lecture → question → diagnose → interactive visual → check → evaluate → reteach differently → concept map updates → resume → "what the TV learned".**

One Next.js project (App Router, TypeScript, Tailwind v4). Frontend and backend live together; Bedrock is only ever called from Route Handlers.

## Run it

```bash
npm install
cp .env.example .env.local   # optional: MOCK_AI=true is the default behaviour
npm run dev                  # http://localhost:3000
```

Open it in a 16:9 window (it scales a fixed 1920×1080 canvas to fit). Use **arrow keys + Enter + Esc/Backspace** only — that's the D-pad.

| URL flag | Effect |
|---|---|
| `?speed=4` | Lecture clock runs 4× (rehearsal) |
| `?keep=1` | Keep learner state across reloads (default: fresh demo on every load) |

## The demo path (mock mode)

1. Lecture plays; the timeline reaches **Excitation**.
2. Focus starts on **Ask a question**. Press ↓ then Enter on the first chip: *"Why does the armature current go up when excitation changes?"* The video pauses.
3. **Thinking** shows a status line and streams the first narration sentence. Then the **phasor diagram** opens — ◀ ▶ moves the excitation slider and the current vector moves live; the in-phase part stays fixed.
4. Enter → check question. Option **A** is focused by default and is the tempting wrong answer → **wrong**.
5. **Not quite** → Enter → TV switches approach: **V-curve + simpler framing** (not a repeat). Move the slider along the curve.
6. Enter → new check question. Option **A** is correct here → **Correct!** The concept map updates live: *Excitation* turns green, *Power factor* is flagged.
7. Enter → lecture resumes. At the end (or sooner with `?speed=4`) the **closing screen** shows before/after maps and what the TV learned. Enter restarts.

The other two chips also work in mock mode (speed, unity power factor). Missing twice triggers the prerequisite lesson; missing three times gives up gracefully.

## Switching to real Bedrock

```bash
# .env.local
MOCK_AI=false
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=<a Claude model / inference-profile id enabled in your account>
# plus standard AWS credentials (env vars, profile, or role)
```

`lib/tutor/bedrockEngine.ts` makes one streaming `ConverseStream` call. The prompt carries the concept-tagged transcript, prerequisite map, learner state and misconception list (no RAG, no vector DB). Output is validated with zod (`lib/tutor/schema.ts`); anything outside the allowed actions/visuals/param ranges — or any Bedrock error — falls back to a safe pre-authored decision, so the demo never dead-ends. If `MOCK_AI` is unset the app uses mock unless `BEDROCK_MODEL_ID` is set.

## Structure

```
app/
  page.tsx                      TV app root (phase -> screen)
  api/session/start/route.ts    lesson + learner summary + start position
  api/ask/route.ts              streams NDJSON: status → first_sentence → decision
  api/answer/route.ts           grades answer → evaluation + next decision + mastery
  api/learner/summary/route.ts  concept-mastery view
components/                     LessonPlayer, ConceptTimeline, VisualStage, CheckQuestion,
                                Feedback, ConceptMap, Closing, Overlays (Listening/Thinking), Status
visuals/                        PhasorDiagram, VCurve, physics, index.ts (registry)
lib/
  tutor/    engine.ts (interface + rule-based policy), mockEngine.ts, bedrockEngine.ts, schema.ts, prompts.ts
  store/    learnerStore.ts     LearnerStore interface + in-memory/JSON-file implementation
  focus/    useFocusGrid.ts     D-pad focus manager
  session/  sessionMachine.ts   Zustand state machine (illegal transitions are ignored)
data/lesson.json                one lesson: 8 timestamped chunks, 8-node prerequisite map, 5 misconceptions
```

## Behaviour worth knowing

- **Rules vs. LLM.** The server decides *what happens next* (correct → mastery up + resume; wrong → reteach with a different visual; wrong twice → weakest prerequisite from the map; third miss → recap). The model only supplies the teaching content. The server holds the pending question, so the client can't tamper with grading.
- **Which concept gets graded** follows the diagnosed misconception (`concept` in `lesson.json`), not where the playhead happens to be.
- **Placeholder lecture.** `videoUrl` is empty, so the lecture is a timed slide-and-caption player. Drop an mp4 in `public/` and set `videoUrl` to `/yourfile.mp4`; the video then drives the clock.
- **Voice** is an optional Web Speech API enhancement inside the Ask overlay; chips are the primary input.
- **Persistence.** Learner state is in memory with a best-effort write to `.data/learners.json`. Serverless hosts (Vercel/Amplify) have no durable disk: implement `LearnerStore` against DynamoDB before deploying beyond a demo.
