
import React from 'react';
import { VoiceConfig } from '../types';

interface VoiceCardProps {
  voice: VoiceConfig;
  isActive: boolean;
  onSelect: (voice: VoiceConfig) => void;
}

const VoiceCard: React.FC<VoiceCardProps> = ({ voice, isActive, onSelect }) => {
  return (
    <button
      onClick={() => onSelect(voice)}
      className={`relative flex flex-col items-start p-5 rounded-3xl transition-all duration-300 text-left w-full border-2 ${
        isActive 
          ? 'bg-brand-surface border-brand-primary shadow-xl shadow-brand-primary/5 translate-y-[-1px]' 
          : 'bg-brand-surface border-transparent hover:border-brand-border/40'
      }`}
    >
      <div className="flex justify-between items-center w-full mb-3">
        <div className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-[0.2em] ${
          isActive ? 'bg-brand-primary text-white' : 'bg-brand-bg text-brand-muted'
        }`}>
          {voice.gender}
        </div>
        {isActive && (
          <div className="w-2 h-2 rounded-full bg-brand-primary animate-pulse" />
        )}
      </div>
      <h3 className={`text-sm font-bold tracking-tight ${isActive ? 'text-brand-text' : 'text-brand-text/80'}`}>
        {voice.name}
      </h3>
      <p className="text-[10px] mt-2 text-brand-muted leading-relaxed line-clamp-2 font-medium opacity-70">
        {voice.description}
      </p>
    </button>
  );
};

export default VoiceCard;
