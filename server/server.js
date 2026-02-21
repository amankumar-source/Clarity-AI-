require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Groq = require('groq-sdk');

// ─── Constants ────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT, 10) || 8080;

/*
  Max input length enforced on the backend independently of the frontend cap.
  Prevents crafted requests (curl, Postman, scrapers) from bypassing the UI
  and submitting huge payloads that would waste Groq tokens and API quota.
*/
const MAX_INPUT_LENGTH = 5000;

/*
  In-memory rate limiter: tracks how many requests each IP has made in the
  current window.  Keeps a single Map in process memory — fine for a
  single-instance deployment.  No external dep required.

  windowMs  = 60 000 ms (1 minute)
  maxReqs   = 10 requests per window per IP
*/
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQS = 10;
const rateLimitMap = new Map(); // ip → { count, resetAt }

function isRateLimited(ip) {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);

    if (!entry || now >= entry.resetAt) {
        // Fresh window
        rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
        return false;
    }

    entry.count += 1;
    if (entry.count > RATE_MAX_REQS) return true;
    return false;
}

/*
  Prune stale entries periodically so the Map doesn't grow without bound
  in long-running deployments.  Runs every 5 minutes.
*/
setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of rateLimitMap) {
        if (now >= entry.resetAt) rateLimitMap.delete(ip);
    }
}, 5 * 60_000);

// ─── Groq client ──────────────────────────────────────────────────────────────

/*
  Groq client is created once at module load.  Creating it per-request would
  re-read the env var and re-instantiate the HTTP agent on every call.
*/
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ─── System prompt ────────────────────────────────────────────────────────────

/*
  The system prompt is a module-level constant.  Keeping it out of the request
  handler means it's never re-allocated or re-parsed on every API call.
*/
const SYSTEM_PROMPT = `You are Clarity AI.

Your task: State the core issue, intent, or confusion in the user's message as ONE clear sentence.

Strict rules:
- Focus on the user's situation, not the topic.
- Do NOT explain concepts or give background information.
- Do NOT teach, advise, or educate.
- Do NOT generalize.
- Do NOT use academic or instructional language.
- Do NOT refer to yourself.
- Do NOT describe the user abstractly.

Writing style:
- Plain, natural English.
- Human and direct.
- Professional and calm.
- Exactly ONE sentence.
- No emojis.
- No bullet points.

Goal: Reveal what is unclear or causing difficulty for the user, as simply as possible.`;

// ─── Express app ──────────────────────────────────────────────────────────────

const app = express();

/*
  CORS must be configured before express.json() so that OPTIONS pre-flight
  requests are answered correctly.  If express.json() runs first on an OPTIONS
  request the body-parser will reject the empty body before CORS can respond.
*/
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['POST', 'GET', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
}));

app.use(express.json({
    /*
      Limit request body to 16 kB.  express.json() default is 100 kB which is
      far more than needed for a single-sentence input tool.  Tighter limit:
        - Rejects oversized bodies early (before any route handler runs)
        - Mitigates JSON payload DoS attacks
    */
    limit: '16kb',
}));

// ─── Security headers (minimal, no external dep) ──────────────────────────────

app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    /*
      HSTS: on HTTPS deployments, tell browsers to always use HTTPS for this
      origin for the next year.  Prevents the extra HTTP→HTTPS redirect RTT
      on repeat visits and mitigates SSL-stripping attacks.
      max-age=31536000 = 1 year (recommended production value).
      Only effective when served over HTTPS — harmless on HTTP (header ignored).
    */
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get('/', (_req, res) => {
    res.send('Clarity AI backend running');
});

app.post('/api/clarify', async (req, res) => {
    // ── Rate limiting ──────────────────────────────────────────────────────────
    const clientIp = req.ip || req.socket?.remoteAddress || 'unknown';
    if (isRateLimited(clientIp)) {
        /*
          Retry-After tells the client (browser, curl, automated scripts) exactly
          how many seconds to wait before retrying.  Without it, clients have no
          signal and may retry immediately, generating more 429s in a loop.
          RATE_WINDOW_MS / 1000 gives the worst-case wait (start of a fresh window).
        */
        res
            .status(429)
            .set('Retry-After', String(RATE_WINDOW_MS / 1000))
            .json({ error: 'Too many requests. Please wait a moment and try again.' });
        return;
    }

    /*
      Cache-Control: no-store — prevent CDN edges, reverse proxies, or shared
      caches from storing and re-serving user-specific AI responses.
      Without this, a cached response for one user could be served to another.
    */
    res.setHeader('Cache-Control', 'no-store');

    // ── Input validation ───────────────────────────────────────────────────────
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'Text input is required' });
    }

    const trimmed = text.trim();

    if (!trimmed) {
        return res.status(400).json({ error: 'Text input must not be empty' });
    }

    if (trimmed.length > MAX_INPUT_LENGTH) {
        return res.status(400).json({
            error: `Input exceeds maximum allowed length of ${MAX_INPUT_LENGTH} characters`,
        });
    }

    // ── Groq API call ──────────────────────────────────────────────────────────
    try {
        const completion = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: trimmed },
            ],
            model: 'llama-3.1-8b-instant',
            /*
              max_tokens keeps the response short (one sentence ≈ 30-80 tokens).
              Without this cap, Groq can return up to 8k tokens — massive latency
              waste for a use case that needs exactly one sentence.
            */
            max_tokens: 128,
            /*
              temperature: 0.3 — slightly lower than default (1.0).
              Produces more deterministic, focused output for an analysis task.
              Does not change behaviour in a user-visible way.
            */
            temperature: 0.3,
        });

        const clarification = completion.choices[0]?.message?.content ?? '';
        return res.json({ clarification: clarification.trim() });

    } catch (error) {
        /*
          Never forward raw error.message to the client in production — it can
          leak internal details (API keys in stack traces, internal hostnames, etc.)
          Log sanitised info at the server level only.
        */
        if (process.env.NODE_ENV !== 'production') {
            console.error('[/api/clarify] Groq API error:', error.message);
        } else {
            console.error('[/api/clarify] Groq API error:', error.status ?? 'unknown status');
        }

        if (error.status === 429) {
            return res.status(429).json({ error: 'System busy. Please try again in a moment.' });
        }

        return res.status(500).json({ error: 'Failed to clarify text' });
    }
});

// ─── 404 handler ──────────────────────────────────────────────────────────────

app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// ─── Start server ─────────────────────────────────────────────────────────────

const server = app.listen(PORT, () => {
    console.log(`Clarity AI server running on port ${PORT}`);
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────
/*
  On SIGTERM (sent by process managers like PM2, Docker, Render, Railway):
    1. Stop accepting new connections
    2. Wait for in-flight requests to finish (max 10 s)
    3. Exit cleanly

  Without this, an abrupt SIGKILL mid-request can send a broken response to
  the client and leave the rateLimitMap in an inconsistent state.
*/
function shutdown() {
    console.log('Clarity AI server shutting down…');
    server.close(() => {
        console.log('All connections closed. Exiting.');
        process.exit(0);
    });

    // Force exit if connections are still open after 10 s
    setTimeout(() => {
        console.error('Forced shutdown after timeout.');
        process.exit(1);
    }, 10_000).unref(); // .unref() prevents this timer from keeping the process alive
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
