
export interface VoiceConfig {
  id: string;
  name: string;
  description: string;
  gender: 'male' | 'female' | 'neutral';
  preview: string;
  isCustom?: boolean;
}

export interface GeneratedClip {
  id: string;
  text: string;
  voiceName: string;
  audioUrl: string;
  timestamp: number;
}

export enum AppMode {
  SINGLE = 'single',
  LAB = 'lab',
  HISTORY = 'history',
  ABOUT = 'about'
}

export interface VoiceAnalysis {
  description: string;
  mappedVoiceId: string;
  traits: string[];
}
