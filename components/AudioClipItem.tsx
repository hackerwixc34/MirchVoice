
import React, { useState, useRef, useEffect } from 'react';
import { GeneratedClip } from '../types';
import { downloadAudio } from '../services/audioService';

interface AudioClipItemProps {
  clip: GeneratedClip;
  onDelete: (id: string) => void;
}

const AudioClipItem: React.FC<AudioClipItemProps> = ({ clip, onDelete }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const safeName = clip.text.slice(0, 20).replace(/[^a-z0-9]/gi, '_').toLowerCase();
    downloadAudio(clip.audioUrl, `MirchVoice_${clip.voiceName}_${safeName}.wav`);
  };

  useEffect(() => {
      const audio = audioRef.current;
      if (!audio) return;
      const handleEnd = () => setIsPlaying(false);
      const handlePlay = () => setIsPlaying(true);
      const handlePause = () => setIsPlaying(false);
      audio.addEventListener('ended', handleEnd);
      audio.addEventListener('play', handlePlay);
      audio.addEventListener('pause', handlePause);
      return () => {
          audio.removeEventListener('ended', handleEnd);
          audio.removeEventListener('play', handlePlay);
          audio.removeEventListener('pause', handlePause);
      };
  }, []);

  return (
    <div className="bg-brand-surface border border-brand-border p-4 rounded-3xl flex items-center gap-4 transition-all hover:bg-brand-surface/80 group">
      <button 
        onClick={togglePlay}
        className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shrink-0 ${
          isPlaying 
            ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' 
            : 'bg-brand-bg text-brand-primary border border-brand-border'
        }`}
      >
        <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play ml-1'}`}></i>
      </button>
      
      <div className="flex-1 min-w-0" onClick={togglePlay}>
        <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-black text-brand-primary uppercase tracking-[0.15em]">{clip.voiceName}</span>
            <span className="text-[8px] text-brand-muted/60 font-black">•</span>
            <span className="text-[9px] text-brand-muted font-bold tracking-tight">{new Date(clip.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
        </div>
        <p className="text-xs text-brand-text/90 line-clamp-1 font-medium">{clip.text}</p>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity md:opacity-100">
        <button 
          onClick={handleDownload}
          className="w-9 h-9 rounded-xl text-brand-muted hover:text-brand-primary hover:bg-brand-primary/10 flex items-center justify-center transition-all"
        >
          <i className="fa-solid fa-download text-[13px]"></i>
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); onDelete(clip.id); }}
          className="w-9 h-9 rounded-xl text-brand-muted hover:text-red-400 hover:bg-red-400/10 flex items-center justify-center transition-all"
        >
          <i className="fa-solid fa-trash-can text-[13px]"></i>
        </button>
      </div>

      <audio ref={audioRef} src={clip.audioUrl} className="hidden" />
    </div>
  );
};

export default AudioClipItem;
