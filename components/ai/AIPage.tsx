
import React, { useState } from 'react';
import { 
    SparklesIcon, LightbulbIcon, DocumentDuplicateIcon, MicrophoneIcon, DocumentTextIcon, PencilAltIcon, CameraIcon, 
    MusicNoteIcon, GlobeAltIcon, PresentationChartBarIcon, ShareIcon, BeakerIcon, UserGroupIcon, TranslateIcon, ClipboardListIcon 
} from '../icons';
import Modal from '../core/Modal';
import AIVoiceTutor from './AIVoiceTutor';
import AISummarizer from './AISummarizer';
import AIWritingAssistant from './AIWritingAssistant';
import AIProblemSolver from './AIProblemSolver';
import AITextToSpeech from './AITextToSpeech';
import AIResearchAssistant from './AIResearchAssistant';
import AIPresentationGenerator from './AIPresentationGenerator';
import AIConceptMapper from './AIConceptMapper';
import AIQuizBuilder from './AIQuizBuilder';
import AIMockInterviewer from './AIMockInterviewer';
import AILanguageTutor from './AILanguageTutor';
import StudyPlanner from './AIStudyPlanner';
import FlashcardGenerator from './AIFlashcardGenerator';
import AITutor from './AITutor';
import AIImageEditor from './AIImageEditor';
import AIImageGenerator from './AIImageGenerator';


const AIPage: React.FC = () => {
    const [activeTool, setActiveTool] = useState<string | null>(null);
    
    const toolConfig = {
        voiceTutor: { 
            icon: MicrophoneIcon, 
            title: 'AI Voice Conversation', 
            description: 'Have a real-time voice conversation with your AI tutor for interactive learning.',
            component: <AIVoiceTutor />,
            color: 'sky-400',
        },
        tutor: { 
            icon: LightbulbIcon, 
            title: 'AI Tutor', 
            description: 'Get explanations, answers, and practice problems for any subject via text.',
            component: <AITutor />,
            color: 'secondary'
        },
        flashcards: { 
            icon: DocumentDuplicateIcon, 
            title: 'Flashcard Generator', 
            description: 'Instantly create interactive study flashcards for any topic.',
            component: <FlashcardGenerator />,
            color: 'danger'
        },
        imageGenerator: {
            icon: CameraIcon,
            title: 'AI Image Generator',
            description: 'Create high-quality images from text descriptions for your projects and presentations.',
            component: <AIImageGenerator />,
            color: 'teal-500',
        },
        diagramGenerator: {
            icon: PencilAltIcon,
            title: 'AI Diagram & Illustration Generator',
            description: 'Bring concepts to life. Describe an event, process, or diagram, and let AI create a visual.',
            component: <AIImageEditor />,
            color: 'cyan-500'
        },
        planner: { 
            icon: SparklesIcon, 
            title: 'AI Study Planner', 
            description: 'Generate a structured one-week study plan to stay on track.',
            component: <StudyPlanner />,
            color: 'primary'
        },
        summarizer: {
            icon: DocumentTextIcon,
            title: 'AI Summarizer',
            description: 'Summarize long texts or articles to get key takeaways instantly.',
            component: <AISummarizer />,
            color: 'amber-500'
        },
        writingAssistant: {
            icon: PencilAltIcon,
            title: 'AI Writing Assistant',
            description: 'Brainstorm essays, improve clarity, and rephrase sentences for academic tone.',
            component: <AIWritingAssistant />,
            color: 'lime-500'
        },
        problemSolver: {
            icon: BeakerIcon,
            title: 'Smart Problem Solver',
            description: 'Snap a picture of a math or physics problem to get a step-by-step solution.',
            component: <AIProblemSolver />,
            color: 'cyan-500'
        },
        textToSpeech: {
            icon: MusicNoteIcon,
            title: 'Text-to-Speech Lecture',
            description: 'Convert your lecture notes into audio to listen on the go.',
            component: <AITextToSpeech />,
            color: 'fuchsia-500'
        },
        researchAssistant: {
            icon: GlobeAltIcon,
            title: 'AI Research Assistant',
            description: 'Find and summarize credible academic sources for your research topic.',
            component: <AIResearchAssistant />,
            color: 'rose-500'
        },
        presentationGenerator: {
            icon: PresentationChartBarIcon,
            title: 'Presentation Generator',
            description: 'Turn your notes or topic into a full presentation with text and layout suggestions.',
            component: <AIPresentationGenerator />,
            color: 'orange-500'
        },
        conceptMapper: {
            icon: ShareIcon,
            title: 'Concept Map Generator',
            description: 'Input a topic to build an interactive mind map of connected sub-topics.',
            component: <AIConceptMapper />,
            color: 'violet-500'
        },
        quizBuilder: {
            icon: ClipboardListIcon,
            title: 'Personalized Quiz Builder',
            description: 'Paste your class notes to generate a practice quiz based on your material.',
            component: <AIQuizBuilder />,
            color: 'green-500'
        },
        mockInterviewer: {
            icon: UserGroupIcon,
            title: 'AI Mock Interviewer',
            description: 'Simulate an interview and get feedback on your answers, pace, and clarity.',
            component: <AIMockInterviewer />,
            color: 'blue-500'
        },
        languageTutor: {
            icon: TranslateIcon,
            title: 'Interactive Language Tutor',
            description: 'Practice conversation and get real-time feedback on pronunciation and grammar.',
            component: <AILanguageTutor />,
            color: 'yellow-500'
        },
    };
    
    const toolOrder: Array<keyof typeof toolConfig> = [
        'voiceTutor', 'tutor', 'flashcards', 'imageGenerator', 'diagramGenerator', 'planner', 'summarizer', 'writingAssistant', 
        'problemSolver', 'textToSpeech', 'researchAssistant', 'presentationGenerator', 'conceptMapper',
        'quizBuilder', 'mockInterviewer', 'languageTutor'
    ];

    const activeToolData = activeTool ? toolConfig[activeTool as keyof typeof toolConfig] : null;
    const activeToolColorClass = activeToolData ? (activeToolData.color.includes('-') ? `[--tool-color:theme(colors.${activeToolData.color})]` : `[--tool-color:theme(colors.${activeToolData.color}.500)]`) : '';

    return (
        <div className="container mx-auto p-4 sm:p-8 space-y-8">
            <div className="text-center">
                <h1 className="text-3xl sm:text-4xl font-bold text-onBackground">AI Tools</h1>
                <p className="mt-2 text-lg text-onSurface max-w-2xl mx-auto">Your personal AI-powered assistant to help you study smarter, not harder.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-12">
                {toolOrder.map((key, index) => {
                    const tool = toolConfig[key];
                    const colorClass = tool.color.includes('-') ? `[--tool-color:theme(colors.${tool.color})]` : `[--tool-color:theme(colors.${tool.color}.500)]`;
                    return (
                        <button
                            key={key}
                            onClick={() => setActiveTool(key)}
                            className={`group p-6 sm:p-8 rounded-2xl text-left bg-surface border border-gray-700 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl ${colorClass} hover:border-[var(--tool-color)] hover:shadow-[var(--tool-color)]/20`}
                            style={{ animation: `fadeInUp 0.5s ease-out ${100 + index * 50}ms forwards`, opacity: 0 }}
                        >
                            <div className="flex items-start gap-4">
                                <div className="p-3 rounded-lg bg-[var(--tool-color)]/10 text-[var(--tool-color)] transition-colors duration-300 group-hover:bg-[var(--tool-color)] group-hover:text-onPrimary">
                                    <tool.icon className="w-8 h-8" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-onBackground group-hover:text-[var(--tool-color)] transition-colors duration-300">{tool.title}</h3>
                                    <p className="mt-1 text-onSurface text-sm">{tool.description}</p>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            <Modal isOpen={!!activeTool} onClose={() => setActiveTool(null)} className={`max-w-4xl h-[80vh] flex flex-col ${activeToolColorClass}`}>
                {activeToolData && (
                    <>
                        <div className="flex items-center gap-4 mb-4 pb-4 border-b border-gray-700 flex-shrink-0">
                            <div className="p-2 rounded-lg bg-[var(--tool-color)]/10 text-[var(--tool-color)]">
                                <activeToolData.icon className="w-8 h-8" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-onBackground">{activeToolData.title}</h2>
                                <p className="text-sm text-onSurface">{activeToolData.description}</p>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto min-h-0">
                            {activeToolData.component}
                        </div>
                    </>
                )}
            </Modal>
        </div>
    );
};

// FIX: Added the missing default export for the AIPage component.
export default AIPage;