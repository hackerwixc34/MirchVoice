
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { decodeBase64, decodeAudioData, audioBufferToWavUrl } from "./audioService";
import { VoiceAnalysis } from "../types";

const API_KEY = process.env.API_KEY || '';

export async function analyzeVoice(audioBase64: string, mimeType: string): Promise<VoiceAnalysis> {
  if (!API_KEY) throw new Error("API Key not found");
  const ai = new GoogleGenAI({ apiKey: API_KEY });

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          { inlineData: { data: audioBase64, mimeType } },
          { text: "Analyze the person's voice in this audio. Describe their vocal characteristics (pitch, tone, speed, emotion) in 15 words or less. Also, decide which of these base voices best matches their range: 'Kore' (warm/female), 'Puck' (energetic/male), 'Charon' (deep/male), 'Zephyr' (crisp/female), or 'Fenrir' (authoritative/male). Return as JSON." }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING },
          mappedVoiceId: { type: Type.STRING },
          traits: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["description", "mappedVoiceId", "traits"]
      }
    }
  });

  return JSON.parse(response.text);
}

export async function generateSpeech(text: string, voiceName: string, personaDescription: string = ""): Promise<string> {
  if (!API_KEY) throw new Error("API Key not found");
  
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
  // We wrap the text in a style instruction to guide the TTS model's prosody and accent
  const stylizedPrompt = personaDescription 
    ? `Speak naturally with a ${personaDescription} accent, avoiding any robotic inflections. Say: ${text}`
    : `Speak naturally with a warm, authentic human tone: ${text}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: stylizedPrompt }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            // Mapping the internal Gemini IDs (Kore, Puck, etc.) to our UI personas
            prebuiltVoiceConfig: { voiceName: voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (!base64Audio) {
      throw new Error("No audio data returned from Gemini API");
    }

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const bytes = decodeBase64(base64Audio);
    const audioBuffer = await decodeAudioData(bytes, audioContext, 24000, 1);
    
    return audioBufferToWavUrl(audioBuffer);
  } catch (error) {
    console.error("Gemini TTS Error:", error);
    throw error;
  }
}
