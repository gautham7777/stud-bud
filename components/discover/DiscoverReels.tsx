import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleGenAI, Type } from "@google/genai";
import { LightbulbIcon, SparklesIcon, XCircleIcon } from '../icons';

interface Fact {
    topic: string;
    fact: string;
}

const FACT_TOPICS = ['Commerce', 'Business Studies', 'Economics', 'Computer Science', 'Informatics Practices', 'General Science', 'Physics', 'Chemistry', 'Biology'];
const GRADIENT_CLASSES = [
    'from-indigo-900/50 via-background to-background',
    'from-teal-900/50 via-background to-background',
    'from-rose-900/50 via-background to-background',
    'from-sky-900/50 via-background to-background',
    'from-amber-900/50 via-background to-background',
    'from-purple-900/50 via-background to-background',
];

const FALLBACK_FACT: Fact = { 
    topic: 'Web Development', 
    fact: 'Did you know the first website ever created is still online today?' 
};


const getFactsFromAI = async (count: number): Promise<Fact[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    
    const factPromises = Array.from({ length: count }).map(async () => {
        try {
            const randomTopic = FACT_TOPICS[Math.floor(Math.random() * FACT_TOPICS.length)];
            const prompt = `Generate a fun, interesting, and short 'Did you know...?' style fact about ${randomTopic}. The fact should be easily understandable by a high school student. The output must be a single JSON object with two keys: 'topic' (a short, one or two-word title for the subject, e.g., 'Gravity', 'Supply and Demand') and 'fact' (the full fact as a string).`;

            const geminiResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            topic: { type: Type.STRING },
                            fact: { type: Type.STRING }
                        },
                        required: ["topic", "fact"]
                    }
                }
            });

            if (geminiResponse.text) {
                const parsedFact = JSON.parse(geminiResponse.text);
                if (parsedFact.fact && parsedFact.topic) {
                    return parsedFact;
                }
            }
        } catch (e) {
            console.warn("A single fact generation failed.", e);
        }
        return null;
    });

    const resolvedFacts = (await Promise.all(factPromises)).filter((f): f is Fact => f !== null);
    return resolvedFacts;
};


const DiscoverReels: React.FC = () => {
    const [status, setStatus] = useState<'loading' | 'success' | 'fetching-more'>('loading');
    const [facts, setFacts] = useState<Fact[]>([]);
    const navigate = useNavigate();
    
    const observer = useRef<IntersectionObserver>();
    const initialFetchCalled = useRef(false);

    // Initial fetch effect
    useEffect(() => {
        if (initialFetchCalled.current) return; // Guard against React StrictMode double-calls
        initialFetchCalled.current = true;

        const loadInitialFacts = async () => {
            try {
                const initialFacts = await getFactsFromAI(3);
                if (initialFacts.length > 0) {
                    setFacts(initialFacts);
                } else {
                    setFacts([FALLBACK_FACT]);
                }
            } catch (error) {
                console.error("Error fetching initial facts:", error);
                setFacts([FALLBACK_FACT]);
            } finally {
                setStatus('success');
            }
        };

        loadInitialFacts();
    }, []);


    const fetchMoreFacts = useCallback(async () => {
        if (status !== 'success') return;
        setStatus('fetching-more');

        try {
            const newFacts = await getFactsFromAI(2);
            if (newFacts.length > 0) {
                setFacts(prev => {
                    const existingFacts = new Set(prev.map(f => f.fact));
                    const uniqueNewFacts = newFacts.filter(f => !existingFacts.has(f.fact));
                    return [...prev, ...uniqueNewFacts];
                });
            }
        } catch (error) {
            console.error("Error fetching more facts:", error);
        } finally {
            setStatus('success');
        }
    }, [status]);


    const lastFactElementRef = useCallback((node: HTMLDivElement) => {
        if (status !== 'success') return;
        if (observer.current) observer.current.disconnect();
        
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting) {
                fetchMoreFacts();
            }
        }, { threshold: 0.8 });

        if (node) observer.current.observe(node);
    }, [status, fetchMoreFacts]);


    return (
        <div className="fixed inset-0 z-30 bg-background w-full h-full overflow-y-auto snap-y snap-mandatory">
            <button 
                onClick={() => navigate('/discover')}
                className="absolute top-4 right-4 z-40 p-2 bg-black/30 rounded-full text-white hover:bg-black/60 transition-colors"
                aria-label="Close Reels"
            >
                <XCircleIcon className="w-8 h-8"/>
            </button>
            
            {status === 'loading' && (
                <div className="h-full w-full snap-start flex items-center justify-center p-8">
                     <div className="flex flex-col items-center gap-4 text-onSurface">
                        <SparklesIcon className="w-12 h-12 animate-pulse text-primary" />
                        <p>Finding interesting facts...</p>
                    </div>
                </div>
            )}

            {status !== 'loading' && facts.map((fact, index) => (
                <div 
                    ref={index === facts.length - 1 ? lastFactElementRef : null}
                    key={`${fact.fact}-${index}`}
                    className={`h-full w-full snap-start flex items-center justify-center p-8 relative bg-gradient-to-b ${GRADIENT_CLASSES[index % GRADIENT_CLASSES.length]}`}
                >
                    <div className="text-center max-w-2xl flex flex-col items-center gap-6">
                        <SparklesIcon className="w-10 h-10 text-primary" />
                        <p className="text-2xl md:text-4xl font-bold text-onBackground leading-relaxed animate-fadeInUp">
                            {fact.fact}
                        </p>
                        <button 
                            onClick={() => navigate('/ai', { state: { tool: 'tutor', topic: fact.topic } })}
                            className="mt-4 inline-flex items-center gap-2 px-6 py-3 bg-surface text-onBackground border border-gray-700 font-semibold rounded-lg hover:bg-primary hover:text-white transition-all duration-300 transform hover:scale-105 shadow-lg"
                        >
                            <LightbulbIcon className="w-5 h-5" />
                            Learn More about {fact.topic}
                        </button>
                    </div>
                </div>
            ))}

            {status === 'fetching-more' && (
                <div className="h-full w-full snap-start flex items-center justify-center p-8">
                     <div className="flex flex-col items-center gap-4 text-onSurface">
                        <SparklesIcon className="w-12 h-12 animate-pulse text-primary" />
                        <p>Finding new facts...</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DiscoverReels;
