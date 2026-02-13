
import React, { useState, useEffect, useRef } from 'react';
import { GEMINI_VOICES } from './constants';
import { VoiceConfig, GeneratedClip, AppMode, VoiceAnalysis } from './types';
import { generateSpeech, analyzeVoice } from './services/geminiService';
import { blobToBase64 } from './services/audioService';
import VoiceCard from './components/VoiceCard';
import AudioClipItem from './components/AudioClipItem';

const OfflineScreen: React.FC = () => (
  <div className="fixed inset-0 z-[2000] bg-brand-bg flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
    <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mb-6 border border-red-500/20">
      <i className="fa-solid fa-plane-slash text-red-500 text-3xl"></i>
    </div>
    <h2 className="text-xl font-bold mb-2">Connection Lost</h2>
    <p className="text-sm text-brand-muted max-w-[240px] leading-relaxed">
      MirchVoice requires an active internet connection to reach our neural processing units.
    </p>
    <button 
      onClick={() => window.location.reload()}
      className="mt-8 px-8 py-3 bg-brand-surface border border-brand-border rounded-2xl text-[10px] font-black uppercase tracking-widest hover:text-brand-primary transition-colors"
    >
      Retry Connection
    </button>
  </div>
);

const SplashScreen: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(onComplete, 600); // Wait for fade-out animation
    }, 2400);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className={`fixed inset-0 z-[1000] flex flex-col items-center justify-center splash-bg transition-opacity duration-700 ${isExiting ? 'opacity-0 scale-105' : 'opacity-100'}`}>
      <div className="relative mb-6 animate-scale-in">
        <div className="w-24 h-24 rounded-[2rem] bg-brand-primary/10 flex items-center justify-center relative">
          <div className="absolute inset-0 rounded-[2rem] border border-brand-primary/20 animate-pulse-slow"></div>
          <i className="fa-solid fa-bolt-lightning text-brand-primary text-5xl drop-shadow-[0_0_15px_rgba(99,102,241,0.5)]"></i>
        </div>
      </div>
      <div className="text-center animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
        <h1 className="text-3xl font-black tracking-tight text-brand-text mb-1">
          Mirch<span className="text-brand-primary">Voice</span>
        </h1>
        <p className="text-[10px] text-brand-muted font-bold uppercase tracking-[0.4em] opacity-60">
          Studio One
        </p>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [showSplash, setShowSplash] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [activeMode, setActiveMode] = useState<AppMode>(AppMode.SINGLE);
  const [selectedVoice, setSelectedVoice] = useState<VoiceConfig>(GEMINI_VOICES[0]);
  const [text, setText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [history, setHistory] = useState<GeneratedClip[]>([]);
  const [lastAudioUrl, setLastAudioUrl] = useState<string | null>(null);
  
  const [isRecording, setIsRecording] = useState(false);
  const [clonedVoice, setClonedVoice] = useState<VoiceAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const visualizerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const saved = localStorage.getItem('voxgemini_history');
    const savedClone = localStorage.getItem('voxgemini_clone');
    if (saved) {
      try { setHistory(JSON.parse(saved)); } catch (e) {}
    }
    if (savedClone) {
        try { setClonedVoice(JSON.parse(savedClone)); } catch (e) {}
    }
    return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('voxgemini_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    if (clonedVoice) localStorage.setItem('voxgemini_clone', JSON.stringify(clonedVoice));
  }, [clonedVoice]);

  const handleGenerate = async () => {
    if (!text.trim()) return;
    setIsGenerating(true);
    try {
      const isCloned = activeMode === AppMode.LAB && clonedVoice;
      const targetVoiceId = isCloned ? clonedVoice.mappedVoiceId : selectedVoice.id;
      const personaDesc = isCloned ? clonedVoice.description : selectedVoice.description;

      const audioUrl = await generateSpeech(text, targetVoiceId, personaDesc);
      
      const newClip: GeneratedClip = {
        id: Math.random().toString(36).substr(2, 9),
        text,
        voiceName: isCloned ? 'Neural Clone' : selectedVoice.name,
        audioUrl,
        timestamp: Date.now()
      };
      
      setHistory(prev => [newClip, ...prev]);
      setLastAudioUrl(audioUrl);
      setTimeout(() => audioRef.current?.play(), 100);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const startRecording = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                sampleRate: 44100
            } 
        });
        
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        const draw = () => {
            if (!visualizerCanvasRef.current) return;
            const canvas = visualizerCanvasRef.current;
            const ctx = canvas.getContext('2d')!;
            animationFrameRef.current = requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const barWidth = (canvas.width / bufferLength) * 2;
            let x = 0;
            for(let i = 0; i < bufferLength; i++) {
                const barHeight = dataArray[i] / 4;
                ctx.fillStyle = '#6366F1';
                ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
                x += barWidth + 2;
            }
        };
        draw();

        const recorder = new MediaRecorder(stream);
        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => chunks.push(e.data);
        recorder.onstop = async () => {
            setIsAnalyzing(true);
            const blob = new Blob(chunks, { type: 'audio/webm' });
            try {
                const base64 = await blobToBase64(blob);
                const analysis = await analyzeVoice(base64, 'audio/webm');
                setClonedVoice(analysis);
            } catch (err) {
                alert("Analysis failed. Ensure you are in a quiet room.");
            } finally {
                setIsAnalyzing(false);
                if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            }
        };

        mediaRecorderRef.current = recorder;
        recorder.start();
        setIsRecording(true);
        setRecordingTime(0);
        timerIntervalRef.current = window.setInterval(() => setRecordingTime(p => p + 1), 1000);
        
        setTimeout(() => { if (recorder.state === 'recording') stopRecording(); }, 10000);

    } catch (err) {
        alert("Microphone access is required for Clone Lab.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const deleteClip = (id: string) => setHistory(prev => prev.filter(c => c.id !== id));

  if (!isOnline) return <OfflineScreen />;
  if (showSplash) return <SplashScreen onComplete={() => setShowSplash(false)} />;

  return (
    <div className="min-h-screen max-w-lg mx-auto flex flex-col bg-brand-bg text-brand-text antialiased font-sans animate-scale-in">
      <header className="px-6 pt-12 pb-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-brand-primary/10 flex items-center justify-center">
            <i className="fa-solid fa-bolt-lightning text-brand-primary text-base"></i>
          </div>
          <h1 className="text-xl font-bold tracking-tight">Mirch<span className="text-brand-primary">Voice</span></h1>
        </div>
        <div className="h-2 w-2 rounded-full bg-brand-accent animate-pulse shadow-[0_0_8px_#10B981]"></div>
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar px-6 pb-32">
        {activeMode === AppMode.SINGLE && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500 pt-2">
            <section>
              <h2 className="text-xs font-bold uppercase tracking-widest text-brand-muted mb-4">Voice Persona</h2>
              <div className="grid grid-cols-2 gap-3">
                {GEMINI_VOICES.map((voice, idx) => (
                  <VoiceCard key={`${voice.id}-${idx}`} voice={voice} isActive={selectedVoice.name === voice.name} onSelect={setSelectedVoice} />
                ))}
              </div>
            </section>

            <section>
              <div className="flex justify-between items-end mb-4">
                <h2 className="text-xs font-bold uppercase tracking-widest text-brand-muted">Script</h2>
                <span className="text-[10px] font-medium text-brand-muted tracking-wide">{text.length.toLocaleString()} characters</span>
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type your message for generation..."
                className="w-full min-h-[160px] bg-brand-surface border border-brand-border rounded-3xl p-6 text-sm leading-relaxed placeholder:text-brand-muted/40 transition-all focus:border-brand-primary/50"
              />
            </section>

            <button
              onClick={handleGenerate}
              disabled={isGenerating || !text.trim()}
              className={`w-full py-5 rounded-3xl font-bold text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 ${
                isGenerating || !text.trim()
                  ? 'bg-brand-surface text-brand-muted cursor-not-allowed border border-brand-border'
                  : 'btn-primary text-white active:scale-[0.98] shadow-lg shadow-brand-primary/10'
              }`}
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  <span>Generating</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-wand-magic-sparkles text-[10px]"></i>
                  <span>Generate Audio</span>
                </>
              )}
            </button>
          </div>
        )}

        {activeMode === AppMode.LAB && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 pt-2">
            <div className="bg-brand-surface border border-brand-border p-10 rounded-[2.5rem] text-center relative overflow-hidden">
              <div className="absolute inset-0 opacity-5 pointer-events-none">
                <canvas ref={visualizerCanvasRef} className="w-full h-full" width={400} height={200} />
              </div>
              <div className="relative z-10">
                <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 transition-all duration-500 shadow-xl ${
                  isRecording ? 'bg-red-500/10 border-red-500/30 ring-4 ring-red-500/5' : 'bg-brand-primary/10 border-brand-primary/20'
                } border`}>
                  {isRecording ? (
                    <span className="text-red-500 font-black text-xl tracking-tight">{recordingTime}s</span>
                  ) : (
                    <i className="fa-solid fa-microphone-lines text-brand-primary text-3xl"></i>
                  )}
                </div>
                <h2 className="text-lg font-bold mb-2">Clone Lab</h2>
                <p className="text-[11px] text-brand-muted mb-10 max-w-[240px] mx-auto leading-relaxed uppercase tracking-wider font-medium">
                  Speak for 10 seconds to map your unique vocal harmonics.
                </p>
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isAnalyzing}
                  className={`px-10 py-4 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                    isRecording 
                      ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' 
                      : 'bg-brand-primary text-white hover:brightness-110 shadow-lg shadow-brand-primary/20'
                  }`}
                >
                  {isRecording ? 'Stop Recording' : 'Start Initialization'}
                </button>
              </div>
            </div>

            {isAnalyzing && (
              <div className="flex items-center justify-center gap-3 py-6">
                <div className="w-4 h-4 border-2 border-brand-primary/20 border-t-brand-primary rounded-full animate-spin"></div>
                <span className="text-[10px] font-bold text-brand-muted uppercase tracking-[0.2em]">Neural Processing...</span>
              </div>
            )}

            {clonedVoice && !isAnalyzing && (
              <div className="bg-brand-surface border border-brand-accent/20 p-8 rounded-[2.5rem] animate-in zoom-in-95 duration-500">
                <div className="flex items-center gap-5 mb-8">
                  <div className="w-12 h-12 rounded-2xl bg-brand-accent/10 flex items-center justify-center text-brand-accent border border-brand-accent/10">
                    <i className="fa-solid fa-fingerprint text-xl"></i>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold tracking-tight">Vocal Twin Active</h3>
                    <p className="text-[10px] text-brand-muted font-bold uppercase tracking-widest mt-0.5">{clonedVoice.description}</p>
                  </div>
                </div>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Type to speak with your clone..."
                  className="w-full min-h-[120px] bg-brand-bg/40 border border-brand-border rounded-2xl p-5 text-sm focus:outline-none mb-6"
                />
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !text.trim()}
                  className={`w-full py-4 rounded-2xl font-bold text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 ${
                    isGenerating || !text.trim()
                      ? 'bg-brand-surface text-brand-muted cursor-not-allowed border border-brand-border'
                      : 'bg-brand-accent text-brand-bg hover:brightness-110 active:scale-[0.98]'
                  }`}
                >
                  {isGenerating ? (
                    <div className="w-4 h-4 border-2 border-brand-bg/20 border-t-brand-bg rounded-full animate-spin"></div>
                  ) : (
                    <span>Generate Clone Audio</span>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {activeMode === AppMode.HISTORY && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 pt-2">
            <div className="flex justify-between items-center">
              <h2 className="text-xs font-bold uppercase tracking-widest text-brand-muted">Studio History</h2>
              {history.length > 0 && (
                <button onClick={() => { if(confirm('Clear history?')) setHistory([]); }} className="text-[10px] font-bold text-red-500/70 hover:text-red-500 transition-colors uppercase tracking-[0.15em]">Clear All</button>
              )}
            </div>
            {history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 text-brand-muted/20">
                <i className="fa-solid fa-inbox text-5xl mb-4"></i>
                <p className="text-[10px] font-black uppercase tracking-[0.3em]">Vault is Empty</p>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map(clip => <AudioClipItem key={clip.id} clip={clip} onDelete={deleteClip} />)}
              </div>
            )}
          </div>
        )}

        {activeMode === AppMode.ABOUT && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500 pt-2">
            <section className="bg-brand-surface border border-brand-border p-8 rounded-[2.5rem] relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none"><i className="fa-solid fa-user-tie text-8xl"></i></div>
              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-14 h-14 rounded-2xl bg-brand-primary/10 flex items-center justify-center text-brand-primary border border-brand-primary/10"><i className="fa-solid fa-code text-2xl"></i></div>
                  <div>
                    <h2 className="text-xl font-bold tracking-tight">William Kampira</h2>
                    <p className="text-[10px] text-brand-primary font-black uppercase tracking-[0.2em] mt-0.5">Founding Developer</p>
                  </div>
                </div>
                <div className="space-y-4 mb-8">
                  <h3 className="text-xs font-black uppercase tracking-widest text-brand-muted">The Mission</h3>
                  <p className="text-sm leading-relaxed text-brand-text/80 font-medium">
                    As the founder of the <span className="text-brand-primary">Malawi Innovations Research and Creativity Hub (MIRCH)</span>, my goal is to bridge the gap between advanced neural technology and practical African accessibility. MirchVoice represents our commitment to localized, high-fidelity AI solutions.
                  </p>
                </div>
                <div className="pt-4">
                   <a href="https://wa.me/265997630340" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-3 w-full py-4 bg-[#25D366] text-white rounded-2xl font-bold text-xs uppercase tracking-[0.15em] hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-[#25D366]/20">
                     <i className="fa-brands fa-whatsapp text-lg"></i>
                     Direct WhatsApp
                   </a>
                </div>
              </div>
            </section>
            <div className="text-center pb-10"><p className="text-[9px] text-brand-muted font-bold uppercase tracking-[0.4em]">© 2024 MIRCH Lab Solutions</p></div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-brand-bg/80 backdrop-blur-2xl border-t border-brand-border z-[100] px-4 pb-10 pt-4 flex justify-between items-center">
        {[
          { id: AppMode.SINGLE, label: 'Studio', icon: 'fa-microphone-lines' },
          { id: AppMode.LAB, label: 'Clone', icon: 'fa-dna' },
          { id: AppMode.HISTORY, label: 'Vault', icon: 'fa-clock-rotate-left' },
          { id: AppMode.ABOUT, label: 'About', icon: 'fa-id-card' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveMode(tab.id as AppMode)}
            className={`flex flex-col items-center gap-1.5 transition-all duration-300 w-20 ${activeMode === tab.id ? 'text-brand-primary' : 'text-brand-muted hover:text-brand-text/50'}`}
          >
            <div className={`text-xl transition-transform ${activeMode === tab.id ? 'scale-110' : 'scale-100'}`}><i className={`fa-solid ${tab.icon}`}></i></div>
            <span className={`text-[9px] font-black uppercase tracking-[0.15em] transition-opacity ${activeMode === tab.id ? 'opacity-100' : 'opacity-60'}`}>{tab.label}</span>
            {activeMode === tab.id && <div className="w-1.5 h-1.5 rounded-full bg-brand-primary mt-0.5 shadow-[0_0_8px_#6366F1]" />}
          </button>
        ))}
      </nav>
      <audio ref={audioRef} src={lastAudioUrl || ''} className="hidden" />
    </div>
  );
};

export default App;
