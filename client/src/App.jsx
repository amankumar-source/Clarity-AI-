import React, { useReducer, useCallback, useRef, useEffect, memo } from 'react';
import { Sparkles, Copy, ThumbsUp, ThumbsDown, RefreshCw, Check, Sun, Moon } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/clarify';
const MAX_INPUT_LENGTH = 2000;

const initialRequestState = {
  loading: false,
  output: '',
  error: '',
  copied: false,
  feedback: null,
};

function requestReducer(state, action) {
  switch (action.type) {
    case 'START':
      return { ...state, loading: true, output: '', error: '', feedback: null, copied: false };
    case 'STREAM_UPDATE':
      return { ...state, output: state.output + action.payload };
    case 'SUCCESS':
      return { ...state, loading: false, output: action.payload || state.output };
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

// ─── InputField Component ───────────────────────────────────────────────
// Extracted to prevent rapid full-page re-renders on keystrokes
const InputField = memo(React.forwardRef(({ onClarify, isDark, loading, outputHasContent }, ref) => {
  const [input, setInput] = React.useState('');

  React.useImperativeHandle(ref, () => ({
    getValue: () => input
  }));

  const handleInputChange = useCallback((e) => {
    setInput(e.target.value);
  }, []);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      onClarify(input);
    }
  }, [onClarify, input]);

  const handleClarifyClick = () => {
    onClarify(input);
  };

  return (
    <div className={`relative transition-all duration-500 ${outputHasContent ? 'opacity-80 hover:opacity-100' : 'opacity-100'}`}>
      <div className={`relative rounded-2xl p-1 transition-all shadow-lg ${isDark ? 'bg-[#111] border border-white/10 focus-within:ring-2 focus-within:ring-emerald-500/50 focus-within:border-emerald-500/50' : 'bg-white border border-gray-200 focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500'}`}>
        <label htmlFor="clarity-input" className="sr-only">Enter your complex thought</label>
        <textarea
          id="clarity-input"
          className={`w-full h-32 bg-transparent text-lg p-4 resize-none outline-none transition-colors duration-300 ${isDark ? 'text-gray-200 placeholder:text-gray-600' : 'text-gray-800 placeholder:text-gray-400'}`}
          placeholder="Paste your complex thought here..."
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          maxLength={MAX_INPUT_LENGTH}
          aria-label="Complex thought input"
          aria-describedby="clarity-hint"
        />

        <div className="flex justify-between items-center px-4 pb-3">
          <span id="clarity-hint" className={`text-xs font-medium transition-colors duration-300 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
            {input.length > 0 ? `${input.length} / ${MAX_INPUT_LENGTH}` : 'Ready'}
          </span>
          <button
            onClick={handleClarifyClick}
            disabled={loading || !input.trim()}
            className={`flex items-center gap-2 px-6 py-2 rounded-xl font-medium transition-all duration-200 ${loading || !input.trim() ? (isDark ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed') : (isDark ? 'bg-white text-black hover:bg-gray-200 hover:scale-105 active:scale-95' : 'bg-gray-900 text-white hover:bg-gray-800 hover:scale-105 active:scale-95')}`}
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
        <p className={`text-xs transition-colors duration-300 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
          Powered by Groq Llama 3 • One sentence output guaranteed
        </p>
      </div>
    </div>
  );
}));

// ─── App Component ───────────────────────────────────────────────────────
function App() {
  const [theme, setTheme] = React.useState('dark'); // 'dark' | 'light'
  const [{ loading, output, error, copied, feedback }, dispatch] = useReducer(
    requestReducer,
    initialRequestState,
  );

  const abortRef = useRef(null);
  const copyTimerRef = useRef(null);
  const inputFieldRef = useRef(null);
  
  // Cache to store previous queries and eliminate unneeded API calls
  const cacheMap = useRef(new Map());

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const executeClarify = useCallback(async (text, { refine = false } = {}) => {
    if (loading) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    if (!refine && cacheMap.current.has(trimmed)) {
      dispatch({ type: 'SUCCESS', payload: cacheMap.current.get(trimmed) });
      return;
    }

    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    dispatch({ type: 'START' });

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed }),
        signal: controller.signal,
      });

      if (!response.ok) {
        let msg = 'Unable to process request.';
        try {
          const data = await response.json();
          msg = data.error || msg;
        } catch {
          if (response.status === 429) msg = 'System busy. Please try again in a moment.';
        }
        throw new Error(msg);
      }

      // Read SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let fullOutput = '';

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const textChunk = decoder.decode(value, { stream: true });
          const lines = textChunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.replace('data: ', '').trim();
              if (dataStr === '[DONE]') {
                done = true;
                break;
              }
              if (dataStr) {
                try {
                  const dataObj = JSON.parse(dataStr);
                  if (dataObj.text) {
                    dispatch({ type: 'STREAM_UPDATE', payload: dataObj.text });
                    fullOutput += dataObj.text;
                  }
                } catch (err) {
                  console.error("Failed to parse SSE JSON chunk:", err);
                }
              }
            }
          }
        }
      }

      dispatch({ type: 'SUCCESS' });
      cacheMap.current.set(trimmed, fullOutput.trim());
      
    } catch (err) {
      if (err.name === 'AbortError') return;
      dispatch({ type: 'ERROR', payload: err.message });
    }
  }, [loading]);

  const handleRefine = useCallback(() => {
    const text = inputFieldRef.current?.getValue() || '';
    executeClarify(text, { refine: true });
  }, [executeClarify]);

  const handleCopy = useCallback(() => {
    if (!output) return;
    navigator.clipboard.writeText(output).catch(console.error);
    dispatch({ type: 'SET_COPIED', payload: true });
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(
      () => dispatch({ type: 'SET_COPIED', payload: false }),
      2000,
    );
  }, [output]);

  const handleThumbsUp = useCallback(() => {
    dispatch({ type: 'SET_FEEDBACK', payload: feedback === 'up' ? null : 'up' });
  }, [feedback]);

  const handleThumbsDown = useCallback(() => {
    dispatch({ type: 'SET_FEEDBACK', payload: feedback === 'down' ? null : 'down' });
  }, [feedback]);

  const isDark = theme === 'dark';

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-4 transition-colors duration-500 ${isDark ? 'bg-[#0a0a0a] text-gray-100 selection:bg-emerald-500/30' : 'bg-gray-50 text-gray-900 selection:bg-emerald-500/20'}`}>
      
      {/* Background with transform-gpu for hardware acceleration */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none" aria-hidden="true">
        <div className={`absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] transition-colors duration-700 transform-gpu ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-500/5'}`} />
        <div className={`absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] transition-colors duration-700 transform-gpu ${isDark ? 'bg-blue-500/10' : 'bg-blue-500/5'}`} />
      </div>

      <div className="absolute top-6 right-6">
        <button
          onClick={toggleTheme}
          className={`p-3 rounded-full shadow-lg border transition-all duration-300 hover:scale-105 active:scale-95 ${isDark ? 'bg-[#1a1a1a] border-white/10 text-emerald-400 hover:bg-[#252525]' : 'bg-white border-gray-200 text-yellow-500 hover:bg-gray-50'}`}
          title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
        >
          {isDark ? <Moon className="w-5 h-5 fill-current" /> : <Sun className="w-5 h-5 fill-current" />}
        </button>
      </div>

      <div className="w-full max-w-2xl space-y-8 flex flex-col pt-12 md:pt-0">
        
        <header className="text-center space-y-2 order-1 animate-fade-in">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className={`p-2 rounded-xl border transition-colors duration-300 ${isDark ? 'bg-gradient-to-br from-emerald-500/20 to-blue-500/20 border-white/10' : 'bg-white border-gray-200 shadow-sm'}`}>
              <Sparkles className="w-6 h-6 text-emerald-500" aria-hidden="true" />
            </div>
          </div>
          <h1 className={`text-4xl font-semibold tracking-tight bg-clip-text text-transparent transition-colors duration-300 ${isDark ? 'bg-gradient-to-b from-white to-white/60' : 'bg-gradient-to-b from-gray-900 to-gray-600'}`}>
            Clarity AI
          </h1>
          <p className={`text-sm font-medium tracking-wide uppercase transition-colors duration-300 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Simplify overthinking into one clear idea.
          </p>
        </header>

        <div className="flex flex-col gap-8 order-2 w-full">
          
          {/* Animated layout shift grid container */}
          <div className={`grid transition-[grid-template-rows,opacity,margin] duration-500 ease-out ${output || loading ? 'grid-rows-[1fr] opacity-100 mb-2' : 'grid-rows-[0fr] opacity-0 mb-0'}`}>
            <div className="overflow-hidden">
              <section
                aria-live="polite"
                className={`group relative rounded-2xl p-6 md:p-8 shadow-2xl transition-colors duration-300 ${isDark ? 'bg-[#111] border border-white/10 hover:border-white/20' : 'bg-white border border-gray-200 shadow-gray-200/50'}`}
              >
                <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={handleCopy}
                    className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-900'}`}
                    title="Copy to clipboard"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                <div className="mb-6">
                  <span className="text-xs font-semibold tracking-wider text-emerald-500 uppercase">Result</span>
                </div>

                <p className={`text-xl md:text-2xl font-medium leading-relaxed transition-colors duration-300 min-h-[4rem] ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>
                  {output}
                  {loading && <span className="inline-block w-2h-6 ml-1 lg:h-8 lg:w-3 bg-emerald-500 animate-pulse align-middle" />}
                </p>

                <div className={`mt-8 flex items-center justify-between border-t pt-4 transition-colors duration-300 ${isDark ? 'border-white/5' : 'border-gray-100'}`}>
                  <div className="flex gap-2" role="group">
                    <button onClick={handleThumbsUp} className={`p-2 rounded-lg transition-colors ${feedback === 'up' ? (isDark ? 'text-emerald-400 bg-emerald-400/10' : 'text-emerald-600 bg-emerald-50') : (isDark ? 'text-gray-500 hover:text-gray-300 hover:bg-white/5' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100')}`}>
                      <ThumbsUp className="w-4 h-4" />
                    </button>
                    <button onClick={handleThumbsDown} className={`p-2 rounded-lg transition-colors ${feedback === 'down' ? (isDark ? 'text-red-400 bg-red-400/10' : 'text-red-600 bg-red-50') : (isDark ? 'text-gray-500 hover:text-gray-300 hover:bg-white/5' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100')}`}>
                      <ThumbsDown className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    onClick={handleRefine}
                    className={`flex items-center gap-2 text-sm transition-colors ${isDark ? 'text-gray-500 hover:text-white' : 'text-gray-400 hover:text-gray-900'}`}
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Refine</span>
                  </button>
                </div>
              </section>
            </div>
          </div>

          <InputField ref={inputFieldRef} onClarify={executeClarify} isDark={isDark} loading={loading} outputHasContent={!!output || loading} />

        </div>

        {error && (
          <div role="alert" className={`order-3 p-4 rounded-xl flex items-center justify-center gap-2 text-sm animate-fade-in ${isDark ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-red-50 border border-red-200 text-red-600'}`}>
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" aria-hidden="true" />
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
