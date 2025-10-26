import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, LiveSession, LiveServerMessage, Modality } from '@google/genai';
import { decode, decodeAudioData, createBlob } from '../../lib/audio';
import { MicrophoneIcon, StopCircleIcon } from '../icons';
import Avatar from '../core/Avatar';
import { useAuth } from '../auth/AuthProvider';

interface Transcription {
    speaker: 'user' | 'model';
    text: string;
}

const AIVoiceTutor: React.FC = () => {
    const { currentUser } = useAuth();
    const [isRecording, setIsRecording] = useState(false);
    const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
    const [statusText, setStatusText] = useState('Click the button to start the conversation.');
    
    const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const nextStartTimeRef = useRef(0);
    const outputSourcesRef = useRef(new Set<AudioBufferSourceNode>());
    
    const currentInputTranscriptionRef = useRef('');
    const currentOutputTranscriptionRef = useRef('');

    const transcriptEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [transcriptions]);
    
    useEffect(() => {
      // Cleanup on component unmount
      return () => {
        if (sessionPromiseRef.current) {
            sessionPromiseRef.current.then(session => session.close());
        }
        cleanupAudio();
      };
    }, []);

    const cleanupAudio = () => {
        mediaStreamRef.current?.getTracks().forEach(track => track.stop());
        scriptProcessorRef.current?.disconnect();
        mediaStreamSourceRef.current?.disconnect();
        inputAudioContextRef.current?.close();
        outputAudioContextRef.current?.close();
    };

    const startConversation = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;
            setIsRecording(true);
            setStatusText('Connecting to AI...');
            setTranscriptions([]);

            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            nextStartTimeRef.current = 0;

            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => {
                        setStatusText('Listening... Say something!');
                        const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
                        mediaStreamSourceRef.current = source;
                        const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current = scriptProcessor;

                        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);
                            sessionPromiseRef.current?.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputAudioContextRef.current!.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (base64Audio) {
                            const outputAudioContext = outputAudioContextRef.current!;
                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContext.currentTime);
                            const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContext, 24000, 1);
                            const source = outputAudioContext.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outputAudioContext.destination);
                            source.addEventListener('ended', () => {
                                outputSourcesRef.current.delete(source);
                            });
                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += audioBuffer.duration;
                            outputSourcesRef.current.add(source);
                        }

                        if (message.serverContent?.outputTranscription) {
                            currentOutputTranscriptionRef.current += message.serverContent.outputTranscription.text;
                        } else if (message.serverContent?.inputTranscription) {
                            currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text;
                        }

                        if (message.serverContent?.turnComplete) {
                            const userInput = currentInputTranscriptionRef.current.trim();
                            const modelOutput = currentOutputTranscriptionRef.current.trim();
                            
                            const newTranscripts: Transcription[] = [];
                            if (userInput) newTranscripts.push({ speaker: 'user', text: userInput });
                            if (modelOutput) newTranscripts.push({ speaker: 'model', text: modelOutput });

                            if(newTranscripts.length > 0) {
                                setTranscriptions(prev => [...prev, ...newTranscripts]);
                            }

                            currentInputTranscriptionRef.current = '';
                            currentOutputTranscriptionRef.current = '';
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error('Session error:', e);
                        setStatusText('An error occurred. Please try again.');
                        stopConversation();
                    },
                    onclose: (e: CloseEvent) => {
                        setStatusText('Conversation ended. Click to start again.');
                        stopConversation();
                    },
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    systemInstruction: 'You are a friendly and helpful study buddy. Keep your answers concise and encouraging.'
                },
            });

        } catch (error) {
            console.error('Failed to start conversation:', error);
            setStatusText('Could not access microphone. Please check permissions.');
            setIsRecording(false);
        }
    };

    const stopConversation = () => {
        setIsRecording(false);
        if (sessionPromiseRef.current) {
            sessionPromiseRef.current.then(session => session.close()).catch(console.error);
            sessionPromiseRef.current = null;
        }
        cleanupAudio();
    };
    
    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-background rounded-lg">
                {transcriptions.map((t, i) => (
                    <div key={i} className={`flex items-start gap-3 ${t.speaker === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {t.speaker === 'model' && <Avatar user={{uid: 'ai', email:'', username:'AI'}} className="w-8 h-8 flex-shrink-0" />}
                        <div className={`max-w-md rounded-lg p-3 text-sm ${t.speaker === 'user' ? 'bg-primary text-white' : 'bg-surface text-onSurface'}`}>
                            {t.text}
                        </div>
                        {t.speaker === 'user' && <Avatar user={currentUser} className="w-8 h-8 flex-shrink-0" />}
                    </div>
                ))}
                <div ref={transcriptEndRef} />
            </div>
            <div className="flex-shrink-0 pt-4 text-center">
                <button
                    onClick={isRecording ? stopConversation : startConversation}
                    className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 focus:outline-none focus:ring-4 mx-auto ${
                        isRecording ? 'bg-danger/80 text-white shadow-lg shadow-danger/30 hover:bg-danger focus:ring-danger/50' : 'bg-primary/80 text-white shadow-lg shadow-primary/30 hover:bg-primary focus:ring-primary/50'
                    }`}
                >
                    {isRecording ? <StopCircleIcon className="w-10 h-10" /> : <MicrophoneIcon className="w-10 h-10" />}
                </button>
                <p className="text-onSurface mt-3 text-sm min-h-[20px]">{statusText}</p>
            </div>
        </div>
    );
};

export default AIVoiceTutor;
