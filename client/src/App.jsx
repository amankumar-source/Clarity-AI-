import React, { useState } from 'react';
import { Sparkles, Copy, ThumbsUp, ThumbsDown, RefreshCw, Check, Sun, Moon } from 'lucide-react';

function App() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState(null); // 'up' | 'down' | null
  const [theme, setTheme] = useState('dark'); // 'dark' | 'light'

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handleClarify = async () => {
    if (loading) return;
    if (!input.trim()) return;

    setLoading(true);
    setError('');
    setOutput('');
    setFeedback(null);
    setCopied(false);

    // Use environment variable for API URL (Vercel) or default to localhost
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/clarify';

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('System busy. Please try again in a moment.');
        }
        throw new Error(data.error || 'Unable to process request.');
      }

      setOutput(data.clarification);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!output) return;
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isDark = theme === 'dark';

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-4 transition-colors duration-500 ${isDark ? 'bg-[#0a0a0a] text-gray-100 selection:bg-emerald-500/30' : 'bg-gray-50 text-gray-900 selection:bg-emerald-500/20'}`}>

      {/* Decorative Background Gradients */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className={`absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] transition-colors duration-700 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-500/5'}`} />
        <div className={`absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] transition-colors duration-700 ${isDark ? 'bg-blue-500/10' : 'bg-blue-500/5'}`} />
      </div>

      {/* Professional Round Theme Toggle */}
      <div className="absolute top-6 right-6">
        <button
          onClick={toggleTheme}
          className={`p-3 rounded-full shadow-lg border transition-all duration-300 hover:scale-105 active:scale-95 ${isDark ? 'bg-[#1a1a1a] border-white/10 text-emerald-400 hover:bg-[#252525]' : 'bg-white border-gray-200 text-yellow-500 hover:bg-gray-50'}`}
          title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
        >
          {isDark ? <Moon className="w-5 h-5 fill-current" /> : <Sun className="w-5 h-5 fill-current" />}
        </button>
      </div>

      <div className="w-full max-w-2xl animate-fade-in space-y-8">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className={`p-2 rounded-xl border transition-colors duration-300 ${isDark ? 'bg-gradient-to-br from-emerald-500/20 to-blue-500/20 border-white/10' : 'bg-white border-gray-200 shadow-sm'}`}>
              <Sparkles className="w-6 h-6 text-emerald-500" />
            </div>
          </div>
          <h1 className={`text-4xl font-semibold tracking-tight bg-clip-text text-transparent transition-colors duration-300 ${isDark ? 'bg-gradient-to-b from-white to-white/60' : 'bg-gradient-to-b from-gray-900 to-gray-600'}`}>
            Clarity AI
          </h1>
          <p className={`text-sm font-medium tracking-wide uppercase transition-colors duration-300 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Simplify overthinking into one clear idea.
          </p>
        </div>

        {/* Output Card */}
        {output && (
          <div className={`group relative rounded-2xl p-6 md:p-8 shadow-2xl transition-all duration-300 ${isDark ? 'bg-[#111] border border-white/10 hover:border-white/20' : 'bg-white border border-gray-200 shadow-gray-200/50'}`}>
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
              <span className="text-xs font-semibold tracking-wider text-emerald-500 uppercase">
                Result
              </span>
            </div>

            <p className={`text-xl md:text-2xl font-medium leading-relaxed transition-colors duration-300 ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>
              {output}
            </p>

            <div className={`mt-8 flex items-center justify-between border-t pt-4 transition-colors duration-300 ${isDark ? 'border-white/5' : 'border-gray-100'}`}>
              <div className="flex gap-2">
                <button
                  onClick={() => setFeedback(feedback === 'up' ? null : 'up')}
                  className={`p-2 rounded-lg transition-colors ${feedback === 'up'
                    ? (isDark ? 'text-emerald-400 bg-emerald-400/10' : 'text-emerald-600 bg-emerald-50')
                    : (isDark ? 'text-gray-500 hover:text-gray-300 hover:bg-white/5' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100')}`}
                >
                  <ThumbsUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setFeedback(feedback === 'down' ? null : 'down')}
                  className={`p-2 rounded-lg transition-colors ${feedback === 'down'
                    ? (isDark ? 'text-red-400 bg-red-400/10' : 'text-red-600 bg-red-50')
                    : (isDark ? 'text-gray-500 hover:text-gray-300 hover:bg-white/5' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100')}`}
                >
                  <ThumbsDown className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={handleClarify}
                className={`flex items-center gap-2 text-sm transition-colors ${isDark ? 'text-gray-500 hover:text-white' : 'text-gray-400 hover:text-gray-900'}`}
              >
                <RefreshCw className="w-3 h-3" />
                <span>Refine</span>
              </button>
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className={`relative transition-all duration-500 ${output ? 'opacity-80 hover:opacity-100' : 'opacity-100'}`}>
          <div className={`relative rounded-2xl p-1 transition-all shadow-lg ${isDark ? 'bg-[#111] border border-white/10 focus-within:ring-2 focus-within:ring-emerald-500/50 focus-within:border-emerald-500/50' : 'bg-white border border-gray-200 focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500'}`}>
            <textarea
              className={`w-full h-32 bg-transparent text-lg p-4 resize-none outline-none transition-colors duration-300 ${isDark ? 'text-gray-200 placeholder:text-gray-600' : 'text-gray-800 placeholder:text-gray-400'}`}
              placeholder="Paste your complex thought here..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleClarify();
                }
              }}
            />

            <div className="flex justify-between items-center px-4 pb-3">
              <span className={`text-xs font-medium transition-colors duration-300 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                {input.length > 0 ? `${input.length} chars` : 'Ready'}
              </span>
              <button
                onClick={handleClarify}
                disabled={loading || !input.trim()}
                className={`flex items-center gap-2 px-6 py-2 rounded-xl font-medium transition-all duration-200 
                  ${loading || !input.trim()
                    ? (isDark ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed')
                    : (isDark ? 'bg-white text-black hover:bg-gray-200 hover:scale-105 active:scale-95' : 'bg-gray-900 text-white hover:bg-gray-800 hover:scale-105 active:scale-95')
                  }`}
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Processing</span>
                  </>
                ) : (
                  <>
                    <span>Clarify</span>
                    <Sparkles className="w-4 h-4" />
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

        {/* Error Message */}
        {error && (
          <div className={`p-4 rounded-xl flex items-center justify-center gap-2 text-sm animate-fade-in ${isDark ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-red-50 border border-red-200 text-red-600'}`}>
            <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
            {error}
          </div>
        )}

      </div>
    </div>
  );
}

export default App;
