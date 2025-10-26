import React, { useState } from 'react';
import { GoogleGenAI, Type } from "@google/genai";

const Flashcard: React.FC<{ front: string; back: string; index: number }> = ({ front, back, index }) => {
    const [isFlipped, setIsFlipped] = useState(false);
    return (
        <div
            className="flashcard-container h-48 w-full cursor-pointer"
            onClick={() => setIsFlipped(!isFlipped)}
            style={{ animation: `fadeInUp 0.5s ease-out ${index * 100}ms forwards`, opacity: 0 }}
        >
            <div className={`flashcard ${isFlipped ? 'is-flipped' : ''}`}>
                <div className="flashcard-face flashcard-front bg-surface border border-gray-700 text-onBackground">
                    <p className="text-center font-semibold">{front}</p>
                </div>
                <div className="flashcard-face flashcard-back bg-secondary/80 border border-secondary text-onSecondary">
                    <p className="text-center">{back}</p>
                </div>
            </div>
        </div>
    );
};

const FlashcardGenerator: React.FC = () => {
    const [topic, setTopic] = useState('');
    const [flashcards, setFlashcards] = useState<{ front: string; back: string }[] | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState('');
    
    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!topic.trim()) return;
        setIsGenerating(true);
        setFlashcards(null);
        setError('');
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const prompt = `Generate 5 to 10 flashcards for the topic: "${topic}". The front should be a term or a question, and the back should be the corresponding definition or answer. Provide the output as a JSON object with a single key "flashcards" which is an array of objects. Each object in the array should have "front" and "back" string properties.`;
            
            const geminiResponse = await ai.models.generateContent({
                model: "gemini-flash-lite-latest",
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            flashcards: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        front: { type: Type.STRING },
                                        back: { type: Type.STRING }
                                    },
                                    required: ["front", "back"]
                                }
                            }
                        },
                        required: ["flashcards"]
                    }
                }
            });

            const result = JSON.parse(geminiResponse.text);
            if (result && result.flashcards && Array.isArray(result.flashcards) && result.flashcards.length > 0) {
                setFlashcards(result.flashcards);
            } else {
                throw new Error("AI returned no flashcards.");
            }

        } catch (err) {
            console.error("Error generating flashcards:", err);
            setError("Sorry, I couldn't generate flashcards for that topic. Please try again.");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
         <div>
             <form onSubmit={handleGenerate} className="flex flex-col sm:flex-row items-center gap-4">
                <input
                    type="text"
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    placeholder="e.g., Key Events of World War II"
                    className="flex-grow w-full p-2 border border-gray-600 rounded-lg bg-surface text-onBackground focus:ring-rose-400 focus:border-rose-400"
                />
                <button type="submit" disabled={isGenerating || !topic.trim()} className="w-full sm:w-auto px-6 py-2 bg-gradient-to-r from-rose-600 to-danger text-white font-semibold rounded-lg hover:from-rose-500 hover:to-rose-600 transition transform active:scale-95 disabled:opacity-50">
                    {isGenerating ? 'Generating...' : 'Create Cards'}
                </button>
             </form>
             {isGenerating && <div className="mt-4 text-center text-onSurface">AI is creating your flashcards...</div>}
             {error && <p className="mt-4 text-center text-danger">{error}</p>}
             {flashcards && (
                 <div className="mt-6">
                    <h3 className="text-lg font-bold mb-4 text-onBackground">Your Flashcards (Click to flip):</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {flashcards.map((card, index) => <Flashcard key={index} front={card.front} back={card.back} index={index}/>)}
                    </div>
                 </div>
             )}
        </div>
    );
};

export default FlashcardGenerator;