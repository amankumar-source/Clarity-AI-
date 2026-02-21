import React, { useReducer, useCallback, useRef, useEffect } from 'react';
import { Sparkles, Copy, ThumbsUp, ThumbsDown, RefreshCw, Check, Sun, Moon } from 'lucide-react';

/*
  API_URL is resolved once at module load time, not inside the render
  function. Previously it was re-evaluated on every render / every API call,
  which is harmless but wasteful.  Moving it to module scope:
    - Reads import.meta.env once (compile-time constant in the Vite bundle)
    - Never allocates a new string on re-renders
*/
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/clarify';

/*
  MAX_INPUT_LENGTH caps the payload sent to the backend.
  Benefits:
    - Prevents unexpectedly large bodies from hitting the API (cost + latency)
    - Reduces accidental re-renders as the character counter truncates naturally
    - Provides a clear UX affordance
*/
const MAX_INPUT_LENGTH = 2000;

// ─── Request state reducer ────────────────────────────────────────────────────
/*
  Replacing 5 individual setState calls in handleClarify with a single
  useReducer dispatch.

  Problem with 5 separate setState calls:
    Each one schedules a re-render synchronously in React 18's batching model
    when called from a non-async context, but inside an async function they can
    each trigger a discrete re-render.  A single dispatch is guaranteed atomic.

  Benefit:
    One dispatch → one re-render, regardless of the async context.
*/
const initialRequestState = {
  loading: false,
  output: '',
  error: '',
  copied: false,
  feedback: null, // 'up' | 'down' | null
};

function requestReducer(state, action) {
  switch (action.type) {
    case 'START':
      // Fired when the user clicks Clarify — resets all transient state atomically
      return { ...state, loading: true, output: '', error: '', feedback: null, copied: false };
    case 'SUCCESS':
      return { ...state, loading: false, output: action.payload };
    case 'ERROR':
      return { ...state, loading: false, error: action.payload };
    case 'SET_COPIED':
      return { ...state, copied: action.payload };
    case 'SET_FEEDBACK':
      return { ...state, feedback: action.payload };
    default:
      return state;
  }
}

function App() {
  const [theme, setTheme] = React.useState('dark'); // 'dark' | 'light'
  const [{ loading, output, error, copied, feedback }, dispatch] = useReducer(
    requestReducer,
    initialRequestState,
  );

  /*
    Ref for the in-flight AbortController.
    When the user triggers "Clarify" again before the first request
    resolves, we cancel the stale request to avoid a race condition where
    a slow response overwrites a fast one.  Also prevents the setState
    calls from firing on an unmounted component.
  */
  const abortRef = useRef(null);

  /*
    Ref for the copy-reset timeout ID so we can clear it on fast subsequent
    clicks (prevents the "copied" label getting stuck if the user clicks
    Copy → Copy in rapid succession before the 2 s window expires).
  */
  const copyTimerRef = useRef(null);

  // ── Input state kept local — not part of the reducer to avoid batching blur
  const [input, setInput] = React.useState('');

  /*
    Cleanup on unmount: cancel any pending copy-reset timer and any
    in-flight network request.  Prevents setState calls on an unmounted
    component (shows as a warning in React DevTools).
  */
  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  // useCallback so this function reference is stable across renders.
  // Child elements that receive it as a prop won't re-render unnecessarily.
  const toggleTheme = useCallback(() => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const handleClarify = useCallback(async () => {
    if (loading) return;
    const trimmed = input.trim();
    if (!trimmed) return;

    // Cancel any previous in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    // Single dispatch replaces 5 discrete setState calls → one re-render
    dispatch({ type: 'START' });

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed }),
        // Attach the abort signal so this fetch is cancellable
        signal: controller.signal,
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('System busy. Please try again in a moment.');
        }
        throw new Error(data.error || 'Unable to process request.');
      }

      dispatch({ type: 'SUCCESS', payload: data.clarification });
    } catch (err) {
      // AbortError fires when we cancel a request intentionally — not an error
      if (err.name === 'AbortError') return;
      dispatch({ type: 'ERROR', payload: err.message });
    }
  }, [input, loading]);

  const handleCopy = useCallback(() => {
    if (!output) return;
    /*
      navigator.clipboard.writeText returns a Promise.  If the page is not
      focused or the Permissions API denies access, it rejects.  Without a
      .catch(), this becomes an unhandled promise rejection, which:
        - Appears as an error in Lighthouse audits
        - Can surface as a console error in DevTools
    */
    navigator.clipboard.writeText(output).catch(console.error);
    dispatch({ type: 'SET_COPIED', payload: true });
    // Clear any pending reset before setting a new one (prevents timer leak)
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(
      () => dispatch({ type: 'SET_COPIED', payload: false }),
      2000,
    );
  }, [output]);

  /*
    Pre-bound stable handlers replace inline arrow functions on the feedback
    buttons.  Inline `() => handleFeedback('up')` creates a new function
    reference on every render (React diffs it as a changed prop, potentially
    scheduling unnecessary work).  useCallback guarantees reference stability.
  */
  const handleThumbsUp = useCallback(() => {
    dispatch({ type: 'SET_FEEDBACK', payload: feedback === 'up' ? null : 'up' });
  }, [feedback]);

  const handleThumbsDown = useCallback(() => {
    dispatch({ type: 'SET_FEEDBACK', payload: feedback === 'down' ? null : 'down' });
  }, [feedback]);

  const handleInputChange = useCallback((e) => {
    setInput(e.target.value);
  }, []);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleClarify();
    }
  }, [handleClarify]);

  const isDark = theme === 'dark';

  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-center p-4 transition-colors duration-500 ${isDark
        ? 'bg-[#0a0a0a] text-gray-100 selection:bg-emerald-500/30'
        : 'bg-gray-50 text-gray-900 selection:bg-emerald-500/20'
        }`}
    >

      {/*
        Decorative Background Gradients
        ─────────────────────────────────────────────────────────────────────
        Performance notes:
          - `will-change: transform` is intentionally NOT set here. These
            elements are completely static (no animation). Setting will-change
            on static elements wastes GPU memory by promoting them to their own
            composited layer for no gain.
          - `pointer-events-none` is kept so the blobs never capture mouse
            events and cause unnecessary hit-testing overhead.
          - The transition is only on `background-color` (via className swap),
            not on expensive filter properties.
      */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none" aria-hidden="true">
        <div
          className={`absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] transition-colors duration-700 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-500/5'
            }`}
        />
        <div
          className={`absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] transition-colors duration-700 ${isDark ? 'bg-blue-500/10' : 'bg-blue-500/5'
            }`}
        />
      </div>

      {/* Theme Toggle */}
      <div className="absolute top-6 right-6">
        <button
          onClick={toggleTheme}
          className={`p-3 rounded-full shadow-lg border transition-all duration-300 hover:scale-105 active:scale-95 ${isDark
            ? 'bg-[#1a1a1a] border-white/10 text-emerald-400 hover:bg-[#252525]'
            : 'bg-white border-gray-200 text-yellow-500 hover:bg-gray-50'
            }`}
          title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
          aria-label={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
        >
          {isDark ? <Moon className="w-5 h-5 fill-current" /> : <Sun className="w-5 h-5 fill-current" />}
        </button>
      </div>

      <div className="w-full max-w-2xl animate-fade-in space-y-8">

        {/* Header */}
        <header className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div
              className={`p-2 rounded-xl border transition-colors duration-300 ${isDark
                ? 'bg-gradient-to-br from-emerald-500/20 to-blue-500/20 border-white/10'
                : 'bg-white border-gray-200 shadow-sm'
                }`}
            >
              <Sparkles className="w-6 h-6 text-emerald-500" aria-hidden="true" />
            </div>
          </div>
          <h1
            className={`text-4xl font-semibold tracking-tight bg-clip-text text-transparent transition-colors duration-300 ${isDark ? 'bg-gradient-to-b from-white to-white/60' : 'bg-gradient-to-b from-gray-900 to-gray-600'
              }`}
          >
            Clarity AI
          </h1>
          <p
            className={`text-sm font-medium tracking-wide uppercase transition-colors duration-300 ${isDark ? 'text-gray-400' : 'text-gray-500'
              }`}
          >
            Simplify overthinking into one clear idea.
          </p>
        </header>

        {/* Output Card */}
        {output && (
          <section
            aria-live="polite"
            aria-label="Clarification result"
            className={`group relative rounded-2xl p-6 md:p-8 shadow-2xl transition-all duration-300 ${isDark
              ? 'bg-[#111] border border-white/10 hover:border-white/20'
              : 'bg-white border border-gray-200 shadow-gray-200/50'
              }`}
          >
            <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={handleCopy}
                className={`p-2 rounded-lg transition-colors ${isDark
                  ? 'hover:bg-white/10 text-gray-400 hover:text-white'
                  : 'hover:bg-gray-100 text-gray-400 hover:text-gray-900'
                  }`}
                title="Copy to clipboard"
                aria-label={copied ? 'Copied!' : 'Copy to clipboard'}
              >
                {copied ? (
                  <Check className="w-4 h-4 text-emerald-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>

            <div className="mb-6">
              <span className="text-xs font-semibold tracking-wider text-emerald-500 uppercase">
                Result
              </span>
            </div>

            <p
              className={`text-xl md:text-2xl font-medium leading-relaxed transition-colors duration-300 ${isDark ? 'text-gray-100' : 'text-gray-800'
                }`}
            >
              {output}
            </p>

            <div
              className={`mt-8 flex items-center justify-between border-t pt-4 transition-colors duration-300 ${isDark ? 'border-white/5' : 'border-gray-100'
                }`}
            >
              <div className="flex gap-2" role="group" aria-label="Rate this response">
                <button
                  onClick={handleThumbsUp}
                  className={`p-2 rounded-lg transition-colors ${feedback === 'up'
                    ? isDark
                      ? 'text-emerald-400 bg-emerald-400/10'
                      : 'text-emerald-600 bg-emerald-50'
                    : isDark
                      ? 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                    }`}
                  aria-label="Thumbs up"
                  aria-pressed={feedback === 'up'}
                >
                  <ThumbsUp className="w-4 h-4" />
                </button>
                <button
                  onClick={handleThumbsDown}
                  className={`p-2 rounded-lg transition-colors ${feedback === 'down'
                    ? isDark
                      ? 'text-red-400 bg-red-400/10'
                      : 'text-red-600 bg-red-50'
                    : isDark
                      ? 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                    }`}
                  aria-label="Thumbs down"
                  aria-pressed={feedback === 'down'}
                >
                  <ThumbsDown className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={handleClarify}
                className={`flex items-center gap-2 text-sm transition-colors ${isDark ? 'text-gray-500 hover:text-white' : 'text-gray-400 hover:text-gray-900'
                  }`}
                aria-label="Refine the result"
              >
                <RefreshCw className="w-3 h-3" aria-hidden="true" />
                <span>Refine</span>
              </button>
            </div>
          </section>
        )}

        {/* Input Area */}
        <div
          className={`relative transition-all duration-500 ${output ? 'opacity-80 hover:opacity-100' : 'opacity-100'
            }`}
        >
          <div
            className={`relative rounded-2xl p-1 transition-all shadow-lg ${isDark
              ? 'bg-[#111] border border-white/10 focus-within:ring-2 focus-within:ring-emerald-500/50 focus-within:border-emerald-500/50'
              : 'bg-white border border-gray-200 focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500'
              }`}
          >
            <label htmlFor="clarity-input" className="sr-only">
              Enter your complex thought
            </label>
            <textarea
              id="clarity-input"
              className={`w-full h-32 bg-transparent text-lg p-4 resize-none outline-none transition-colors duration-300 ${isDark ? 'text-gray-200 placeholder:text-gray-600' : 'text-gray-800 placeholder:text-gray-400'
                }`}
              placeholder="Paste your complex thought here..."
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              maxLength={MAX_INPUT_LENGTH}
              aria-label="Complex thought input"
              aria-describedby="clarity-hint"
            />

            <div className="flex justify-between items-center px-4 pb-3">
              <span
                id="clarity-hint"
                className={`text-xs font-medium transition-colors duration-300 ${isDark ? 'text-gray-600' : 'text-gray-400'
                  }`}
              >
                {input.length > 0
                  ? `${input.length} / ${MAX_INPUT_LENGTH}`
                  : 'Ready'}
              </span>
              <button
                onClick={handleClarify}
                disabled={loading || !input.trim()}
                className={`flex items-center gap-2 px-6 py-2 rounded-xl font-medium transition-all duration-200 ${loading || !input.trim()
                  ? isDark
                    ? 'bg-white/5 text-gray-500 cursor-not-allowed'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : isDark
                    ? 'bg-white text-black hover:bg-gray-200 hover:scale-105 active:scale-95'
                    : 'bg-gray-900 text-white hover:bg-gray-800 hover:scale-105 active:scale-95'
                  }`}
                aria-label={loading ? 'Processing your request' : 'Clarify'}
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />
                    <span>Processing</span>
                  </>
                ) : (
                  <>
                    <span>Clarify</span>
                    <Sparkles className="w-4 h-4" aria-hidden="true" />
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="mt-3 text-center">
            <p
              className={`text-xs transition-colors duration-300 ${isDark ? 'text-gray-600' : 'text-gray-400'
                }`}
            >
              Powered by Groq Llama 3 • One sentence output guaranteed
            </p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div
            role="alert"
            className={`p-4 rounded-xl flex items-center justify-center gap-2 text-sm animate-fade-in ${isDark
              ? 'bg-red-500/10 border border-red-500/20 text-red-400'
              : 'bg-red-50 border border-red-200 text-red-600'
              }`}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" aria-hidden="true" />
            {error}
          </div>
        )}

      </div>
    </div>
  );
}

export default App;
