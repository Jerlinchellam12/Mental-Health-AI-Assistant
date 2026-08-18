import { GoogleGenAI } from "@google/genai";

// Initialize Gemini AI
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

/**
 * Helper to convert a Blob to a base64 string
 */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Speech-to-Text using Gemini
 */
export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  try {
    const base64Audio = await blobToBase64(audioBlob);
    
    const response = await genAI.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          inlineData: {
            mimeType: audioBlob.type || "audio/webm",
            data: base64Audio,
          },
        },
        { text: "Transcribe this audio exactly as spoken. Return only the transcription text." },
      ],
    });

    return response.text || '';
  } catch (error) {
    console.error('Gemini Transcription Error:', error);
    throw new Error('Failed to transcribe audio. Please try again.');
  }
}

/**
 * Helper to wrap raw PCM data in a WAV container
 */
function wrapPcmInWav(pcmData: Uint8Array, sampleRate: number = 24000): Blob {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * bitsPerSample / 8;
  const blockAlign = numChannels * bitsPerSample / 8;
  const dataSize = pcmData.length;
  const chunkSize = 36 + dataSize;

  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  // RIFF identifier
  view.setUint8(0, 'R'.charCodeAt(0));
  view.setUint8(1, 'I'.charCodeAt(0));
  view.setUint8(2, 'F'.charCodeAt(0));
  view.setUint8(3, 'F'.charCodeAt(0));
  // File length
  view.setUint32(4, chunkSize, true);
  // WAVE identifier
  view.setUint8(8, 'W'.charCodeAt(0));
  view.setUint8(9, 'A'.charCodeAt(0));
  view.setUint8(10, 'V'.charCodeAt(0));
  view.setUint8(11, 'E'.charCodeAt(0));
  // fmt chunk identifier
  view.setUint8(12, 'f'.charCodeAt(0));
  view.setUint8(13, 'm'.charCodeAt(0));
  view.setUint8(14, 't'.charCodeAt(0));
  view.setUint8(15, ' '.charCodeAt(0));
  // fmt chunk length
  view.setUint32(16, 16, true);
  // sample format (raw PCM)
  view.setUint16(20, 1, true);
  // channel count
  view.setUint16(22, numChannels, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sample rate * block align)
  view.setUint32(28, byteRate, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, blockAlign, true);
  // bits per sample
  view.setUint16(34, bitsPerSample, true);
  // data chunk identifier
  view.setUint8(36, 'd'.charCodeAt(0));
  view.setUint8(37, 'a'.charCodeAt(0));
  view.setUint8(38, 't'.charCodeAt(0));
  view.setUint8(39, 'a'.charCodeAt(0));
  // data chunk length
  view.setUint32(40, dataSize, true);

  return new Blob([header, pcmData], { type: 'audio/wav' });
}

/**
 * Helper to strip markdown for cleaner TTS
 */
function stripMarkdown(text: string): string {
  return text
    .replace(/(\*\*|__)(.*?)\1/g, '$2') // bold
    .replace(/(\*|_)(.*?)\1/g, '$2')   // italic
    .replace(/\[(.*?)\]\(.*?\)/g, '$1') // links
    .replace(/#{1,6}\s+(.*)/g, '$1')    // headers
    .replace(/`{1,3}.*?`{1,3}/gs, '')   // code blocks
    .replace(/>\s+(.*)/g, '$1')         // quotes
    .replace(/\n+/g, ' ')               // newlines to spaces
    .trim();
}

/**
 * Text-to-Speech using Gemini
 */
export async function textToSpeech(text: string): Promise<Blob> {
  try {
    const cleanText = stripMarkdown(text).slice(0, 1000);
    if (!cleanText) {
      throw new Error('No text to speak after cleaning');
    }

    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: cleanText }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' }, // Warm, friendly voice
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error('No audio data received from Gemini');
    }

    // Convert base64 back to Uint8Array
    const byteCharacters = atob(base64Audio);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    
    // Wrap raw PCM in WAV container
    return wrapPcmInWav(byteArray, 24000);
  } catch (error) {
    console.error('Gemini TTS Error:', error);
    throw new Error('Failed to generate speech. Please try again.');
  }
}

/**
 * Audio recorder utility using MediaRecorder API
 */
export function createAudioRecorder() {
  let mediaRecorder: MediaRecorder | null = null;
  let audioChunks: Blob[] = [];

  return {
    async start(): Promise<void> {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunks = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunks.push(event.data);
      };
      mediaRecorder.start();
    },
    stop(): Promise<Blob> {
      return new Promise((resolve) => {
        if (!mediaRecorder) return resolve(new Blob());
        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          mediaRecorder?.stream.getTracks().forEach(t => t.stop());
          resolve(audioBlob);
        };
        mediaRecorder.stop();
      });
    },
    isRecording(): boolean {
      return mediaRecorder?.state === 'recording';
    }
  };
}

/**
 * Play audio blob through speakers and return promise that resolves when done
 */
export function playAudioBlob(
  blob: Blob, 
  onStart?: () => void, 
  onEnd?: () => void
): Promise<void> {
  return new Promise((resolve) => {
    const audioBlob = new Blob([blob], { type: 'audio/wav' });
    const url = URL.createObjectURL(audioBlob);
    const audio = new Audio();
    
    audio.onplay = () => {
      if (onStart) onStart();
    };
    audio.onended = () => {
      URL.revokeObjectURL(url);
      if (onEnd) onEnd();
      resolve();
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      if (onEnd) onEnd();
      resolve();
    };
    
    audio.src = url;
    audio.play().catch(() => {
      if (onEnd) onEnd();
      resolve();
    });
  });
}
