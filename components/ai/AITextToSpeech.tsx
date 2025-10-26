import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { decode, decodeAudioData } from '../../lib/audio';

const AITextToSpeech: React.FC = () => {
    const [text, setText] = useState('');
    const [audioData, setAudioData] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState('');
    const audioRef = useRef<HTMLAudioElement>(null);

    const handleGenerateAudio = async () => {
        if (!text.trim()) return;
        setIsGenerating(true);
        setAudioData(null);
        setError('');
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash-preview-tts",
                contents: [{ parts: [{ text: text }] }],
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName: 'Kore' },
                        },
                    },
                },
            });
            const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
                // The browser can play raw PCM data if we create a WAV header for it.
                // This is simpler than using the Web Audio API for simple playback.
                const pcmData = decode(base64Audio);
                const wavBlob = createWavBlob(pcmData, 1, 24000);
                const audioUrl = URL.createObjectURL(wavBlob);
                setAudioData(audioUrl);
            } else {
                throw new Error("No audio data received from API.");
            }
        } catch (err) {
            console.error("Error generating audio:", err);
            setError("Sorry, I couldn't generate audio for that text. Please try again.");
        } finally {
            setIsGenerating(false);
        }
    };
    
    // Helper to create a WAV file blob from raw PCM data
    const createWavBlob = (pcmData: Uint8Array, numChannels: number, sampleRate: number): Blob => {
        const header = new ArrayBuffer(44);
        const view = new DataView(header);
        const pcmLength = pcmData.length;

        // RIFF chunk descriptor
        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + pcmLength, true);
        writeString(view, 8, 'WAVE');
        // "fmt " sub-chunk
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true); // Subchunk1Size for PCM
        view.setUint16(20, 1, true); // AudioFormat for PCM
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numChannels * 2, true); // ByteRate
        view.setUint16(32, numChannels * 2, true); // BlockAlign
        view.setUint16(34, 16, true); // BitsPerSample
        // "data" sub-chunk
        writeString(view, 36, 'data');
        view.setUint32(40, pcmLength, true);

        return new Blob([header, pcmData], { type: 'audio/wav' });
    };

    const writeString = (view: DataView, offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    };
    
    useEffect(() => {
        if (audioData && audioRef.current) {
            audioRef.current.play();
        }
    }, [audioData]);

    return (
        <div>
            <textarea 
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste your lecture notes or any text here..."
                className="w-full p-3 border border-gray-600 rounded-lg bg-surface text-onBackground focus:ring-fuchsia-500 focus:border-fuchsia-500"
                rows={10}
            />
            <div className="mt-4 flex justify-end">
                <button 
                    onClick={handleGenerateAudio} 
                    disabled={isGenerating || !text.trim()} 
                    className="w-full sm:w-auto px-6 py-2 bg-gradient-to-r from-fuchsia-600 to-fuchsia-500 text-white font-semibold rounded-lg hover:from-fuchsia-500 hover:to-fuchsia-400 transition transform active:scale-95 disabled:opacity-50"
                >
                    {isGenerating ? 'Generating Audio...' : 'Generate Audio'}
                </button>
            </div>

            {error && <p className="mt-4 text-center text-danger">{error}</p>}

            {audioData && (
                <div className="mt-6 animate-fadeInUp">
                    <audio ref={audioRef} controls src={audioData} className="w-full">
                        Your browser does not support the audio element.
                    </audio>
                </div>
            )}
        </div>
    );
};

export default AITextToSpeech;
