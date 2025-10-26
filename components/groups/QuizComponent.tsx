import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { db } from '../../firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc } from 'firebase/firestore';
import { Quiz, QuizAttempt, StudyGroup } from '../../types';
import { GoogleGenAI, Type } from "@google/genai";
import Modal from '../core/Modal';
import { ClipboardListIcon } from '../icons';

const QuizLeaderboard: React.FC<{ quizId: string }> = ({ quizId }) => {
    const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // FIX: Removed orderBy("score", "desc") from the query to prevent a crash caused by a missing composite index.
        // The sorting is now handled on the client-side after fetching the data.
        const q = query(collection(db, "quizAttempts"), where("quizId", "==", quizId));
        const unsubscribe = onSnapshot(q, snapshot => {
            const attemptsData = snapshot.docs.map(doc => doc.data() as QuizAttempt);
            // Sort by score in descending order on the client
            attemptsData.sort((a, b) => b.score - a.score);
            setAttempts(attemptsData);
            setLoading(false);
        });
        return unsubscribe;
    }, [quizId]);

    if (loading) return <div className="p-4 text-center text-onSurface">Loading scores...</div>;

    return (
        <div>
            <h2 className="text-2xl font-bold mb-4 text-onBackground flex items-center gap-2"><ClipboardListIcon className="w-8 h-8 text-secondary" /> Quiz Results</h2>
            {attempts.length > 0 ? (
                <ul className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                    {attempts.map((attempt, index) => (
                         <li key={index} className="flex items-center justify-between p-2 bg-background rounded-md border border-gray-700">
                             <div className="flex items-center gap-3">
                                <span className={`font-bold text-lg w-8 text-center ${index === 0 ? 'text-amber-400' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-amber-600' : 'text-secondary'}`}>{index + 1}</span>
                                <span className="font-semibold text-onBackground">{attempt.username}</span>
                             </div>
                            <div className="text-secondary font-bold">{attempt.score} / {attempt.totalQuestions}</div>
                         </li>
                    ))}
                </ul>
            ) : (
                <p className="mt-4 text-onSurface">No one has attempted this quiz yet.</p>
            )}
        </div>
    );
};

const QuizComponent: React.FC<{ group: StudyGroup }> = ({ group }) => {
    const { currentUser, currentUserProfile, updateProfile } = useAuth();
    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [score, setScore] = useState(0);
    const [isQuizOver, setIsQuizOver] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState('');
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
    const [isLeaderboardModalOpen, setIsLeaderboardModalOpen] = useState(false);

    const generateQuiz = async () => {
        setIsGenerating(true);
        setError('');
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const prompt = `Generate a 5-question multiple choice quiz about ${group.subjectName}. For each question, provide 4 options and indicate the correct answer. Format the output as a JSON object with a "questions" array. Each object in the array should have "question", "options" (an array of 4 strings), and "correctAnswer" (a string matching one of the options).`;
            
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
                                        options: { type: Type.ARRAY, items: { type: Type.STRING } },
                                        correctAnswer: { type: Type.STRING }
                                    },
                                    required: ["question", "options", "correctAnswer"]
                                }
                            }
                        },
                        required: ["questions"]
                    },
                }
            });

            try {
                const quizData = JSON.parse(geminiResponse.text.trim());
                
                if (!quizData || !quizData.questions || !Array.isArray(quizData.questions) || quizData.questions.length === 0) {
                     throw new Error("AI returned no questions.");
                }
    
                const newQuiz: Quiz = {
                    id: `quiz-${Date.now()}`,
                    groupId: group.id,
                    subjectName: group.subjectName,
                    questions: quizData.questions,
                    createdBy: currentUser!.uid,
                    createdAt: Date.now(),
                };
                setQuiz(newQuiz);
                setCurrentQuestion(0);
                setScore(0);
                setIsQuizOver(false);
            } catch (parseError) {
                console.error("Failed to parse quiz data from AI response:", parseError, "Raw text:", geminiResponse.text);
                setError('Failed to generate a valid quiz. The AI might be having trouble. Please try again.');
            }

        } catch (e) {
            console.error(e);
            setError('Failed to generate quiz. The AI might be busy. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleAnswer = async (answer: string) => {
        if (!quiz || selectedAnswer || !currentUser) return;
        
        const correctAnswer = quiz.questions[currentQuestion].correctAnswer;
        const newScore = answer === correctAnswer ? score + 1 : score;
        setSelectedAnswer(answer);
        
        if (answer === correctAnswer) {
            setIsCorrect(true);
        } else {
            setIsCorrect(false);
        }

        setTimeout(async () => {
            setSelectedAnswer(null);
            setIsCorrect(null);
            setScore(newScore);

            if (currentQuestion < quiz.questions.length - 1) {
                setCurrentQuestion(q => q + 1);
            } else {
                setIsQuizOver(true);
                // Save attempt
                await addDoc(collection(db, "quizAttempts"), {
                    quizId: quiz.id,
                    userId: currentUser.uid,
                    username: currentUser.username,
                    score: newScore,
                    totalQuestions: quiz.questions.length,
                    completedAt: Date.now(),
                });
                
                // Award a win for >50% score
                if (newScore / quiz.questions.length > 0.5) {
                    await updateProfile({ quizWins: (currentUserProfile?.quizWins || 0) + 1 });
                }
            }
        }, 1500);
    };

    const resetQuiz = () => {
        setQuiz(null);
        setIsQuizOver(false);
    };
    
    const getButtonClass = (option: string) => {
        if (!selectedAnswer) return "bg-gray-700 hover:bg-primary/50";
        const isCorrectAnswer = option === quiz!.questions[currentQuestion].correctAnswer;
        if (isCorrectAnswer) return "bg-green-500 text-white";
        if (option === selectedAnswer && !isCorrect) return "bg-danger text-white";
        return "bg-gray-700 opacity-50";
    };

    if (isQuizOver && quiz) {
        return (
            <div className="text-center p-4">
                <h3 className="text-2xl font-bold">Quiz Complete!</h3>
                <p className="text-xl mt-2">Your score: {score} / {quiz.questions.length}</p>
                 <div className="flex justify-center gap-4 mt-4">
                    <button onClick={resetQuiz} className="px-4 py-2 bg-primary text-white rounded-lg">Try Another Quiz</button>
                    <button onClick={() => setIsLeaderboardModalOpen(true)} className="px-4 py-2 bg-secondary text-white rounded-lg">View Leaderboard</button>
                </div>
                <Modal isOpen={isLeaderboardModalOpen} onClose={() => setIsLeaderboardModalOpen(false)}><QuizLeaderboard quizId={quiz.id} /></Modal>
            </div>
        );
    }

    if (quiz) {
        const question = quiz.questions[currentQuestion];
        return (
            <div className="p-4">
                <p className="text-sm text-onSurface">Question {currentQuestion + 1} of {quiz.questions.length}</p>
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

    return (
        <div className="text-center p-4">
            <p className="mb-4 text-onSurface">Challenge your group members with a quick quiz on {group.subjectName}!</p>
            <div className="flex justify-center gap-4">
                <button onClick={generateQuiz} disabled={isGenerating} className="px-6 py-3 bg-gradient-to-r from-secondary to-teal-500 text-white font-semibold rounded-lg hover:from-teal-500 hover:to-teal-400 transition transform active:scale-95 disabled:opacity-50">
                    {isGenerating ? 'Generating...' : 'Start New Quiz'}
                </button>
            </div>
            {error && <p className="text-danger mt-2">{error}</p>}
        </div>
    );
};

export default QuizComponent;