import React, { useState } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { Question } from '../../types';

const AIQuizBuilder: React.FC = () => {
    const [notes, setNotes] = useState('');
    const [quiz, setQuiz] = useState<Question[] | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState('');

    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [score, setScore] = useState(0);
    const [isQuizOver, setIsQuizOver] = useState(false);
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    
    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!notes.trim()) return;
        setIsGenerating(true);
        setQuiz(null);
        setError('');
        setIsQuizOver(false);
        setCurrentQuestion(0);
        setScore(0);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const prompt = `Based on the following notes, generate a 5-question multiple choice quiz. For each question, provide 4 options and the correct answer.\n\nNotes:\n${notes}`;
            
            const geminiResponse = await ai.models.generateContent({
                model: "gemini-flash-lite-latest",
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            questions: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        question: { type: Type.STRING },
                                        options: { type: Type.ARRAY, items: { type: Type.STRING }, maxItems: 4, minItems: 4 },
                                        correctAnswer: { type: Type.STRING }
                                    },
                                    required: ["question", "options", "correctAnswer"]
                                }
                            }
                        },
                        required: ["questions"]
                    }
                }
            });

            const result = JSON.parse(geminiResponse.text);
            if (result && result.questions && Array.isArray(result.questions) && result.questions.length > 0) {
                setQuiz(result.questions);
            } else {
                throw new Error("AI returned no questions.");
            }
        } catch (err) {
            console.error("Error generating quiz:", err);
            setError("Sorry, I couldn't generate a quiz from these notes. Please try again with more detailed notes.");
        } finally {
            setIsGenerating(false);
        }
    };
    
    const handleAnswer = (answer: string) => {
        if (selectedAnswer) return;

        setSelectedAnswer(answer);
        const isCorrect = answer === quiz![currentQuestion].correctAnswer;
        if (isCorrect) setScore(s => s + 1);

        setTimeout(() => {
            if (currentQuestion < quiz!.length - 1) {
                setCurrentQuestion(q => q + 1);
                setSelectedAnswer(null);
            } else {
                setIsQuizOver(true);
            }
        }, 1500);
    };
    
    const getButtonClass = (option: string) => {
        if (!selectedAnswer) return "bg-gray-700 hover:bg-primary/50";
        const isCorrectAnswer = option === quiz![currentQuestion].correctAnswer;
        if (isCorrectAnswer) return "bg-green-500 text-white";
        if (option === selectedAnswer && !isCorrectAnswer) return "bg-danger text-white";
        return "bg-gray-700 opacity-50";
    };

    const restartQuiz = () => {
        setQuiz(null);
        setIsQuizOver(false);
        setCurrentQuestion(0);
        setScore(0);
        setSelectedAnswer(null);
    }

    if(quiz && !isQuizOver) {
        const question = quiz[currentQuestion];
         return (
            <div className="p-4 animate-fadeInUp">
                <p className="text-sm text-onSurface">Question {currentQuestion + 1} of {quiz.length}</p>
                <h4 className="text-lg font-semibold my-2">{question.question}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {question.options.map((opt, i) => (
                        <button key={i} onClick={() => handleAnswer(opt)} disabled={!!selectedAnswer} className={`p-3 text-left rounded-lg transition-all duration-300 ${getButtonClass(opt)}`}>
                            {opt}
                        </button>
                    ))}
                </div>
            </div>
        );
    }
    
    if(isQuizOver) {
        return (
            <div className="text-center p-4 animate-fadeInUp">
                <h3 className="text-2xl font-bold">Quiz Complete!</h3>
                <p className="text-xl mt-2">Your score: {score} / {quiz!.length}</p>
                 <div className="flex justify-center gap-4 mt-4">
                    <button onClick={restartQuiz} className="px-4 py-2 bg-primary text-white rounded-lg">Create Another Quiz</button>
                </div>
            </div>
        );
    }

    return (
        <div>
            <form onSubmit={handleGenerate}>
                <textarea 
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Paste your class notes here..."
                    className="w-full p-3 border border-gray-600 rounded-lg bg-surface text-onBackground focus:ring-green-500 focus:border-green-500"
                    rows={10}
                />
                <div className="mt-4 flex justify-end">
                    <button type="submit" disabled={isGenerating || !notes.trim()} className="w-full sm:w-auto px-6 py-2 bg-gradient-to-r from-green-600 to-green-500 text-white font-semibold rounded-lg hover:from-green-500 hover:to-green-400 transition transform active:scale-95 disabled:opacity-50">
                        {isGenerating ? 'Building Quiz...' : 'Build Quiz'}
                    </button>
                </div>
            </form>
            {isGenerating && <div className="mt-4 text-center text-onSurface">AI is building your personalized quiz...</div>}
            {error && <p className="mt-4 text-center text-danger">{error}</p>}
        </div>
    );
};

export default AIQuizBuilder;