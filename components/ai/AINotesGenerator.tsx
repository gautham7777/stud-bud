
import React, { useState, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { AIResponse } from './common';
import { DocumentTextIcon } from '../icons';

declare global {
    interface Window {
        jspdf: any;
        html2canvas: any;
    }
}

const AINotesGenerator: React.FC = () => {
    const [topic, setTopic] = useState('');
    const [notes, setNotes] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isExtending, setIsExtending] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [error, setError] = useState('');
    const notesContainerRef = useRef<HTMLDivElement>(null);

    const handleGenerate = async (e: React.FormEvent, extend = false) => {
        e.preventDefault();
        if (!topic.trim()) return;

        extend ? setIsExtending(true) : setIsGenerating(true);
        if (!extend) {
            setNotes('');
        }
        setError('');

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const prompt = extend 
                ? `Extend and elaborate on the following study notes about "${topic}". Add more detail, examples, and explanations. Do not repeat the existing content, but build upon it seamlessly. The existing notes are:\n\n${notes}`
                : `Generate detailed, well-structured study notes on the topic: "${topic}". Use markdown for formatting, including headings, subheadings, bullet points, and bold text to organize the information clearly for a student.`;

            const responseStream = await ai.models.generateContentStream({
                model: 'gemini-flash-lite-latest',
                contents: prompt,
            });
            
            let initialText = extend ? notes + "\n\n" : "";
            setNotes(initialText);

            for await (const chunk of responseStream) {
                initialText += chunk.text;
                setNotes(initialText);
            }
        } catch (err) {
            console.error("Error generating notes:", err);
            setError("Sorry, I couldn't generate notes for that topic. Please try again.");
            if (!extend) setNotes(null);
        } finally {
            extend ? setIsExtending(false) : setIsGenerating(false);
        }
    };

    const handleDownloadPdf = async () => {
        if (!notesContainerRef.current || !notes) return;
        setIsDownloading(true);

        try {
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'pt',
                format: 'a4'
            });

            const elementToCapture = notesContainerRef.current.querySelector('.prose');
            if (!elementToCapture) {
                throw new Error("Could not find notes content to capture.");
            }

            const canvas = await window.html2canvas(elementToCapture as HTMLElement, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#1f2937',
            });

            const imgData = canvas.toDataURL('image/png');
            const imgProps = pdf.getImageProperties(imgData);
            const pdfWidth = pdf.internal.pageSize.getWidth() - 80; // with margins
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

            let heightLeft = pdfHeight;
            let position = 0;
            const pageHeight = pdf.internal.pageSize.getHeight();

            pdf.addImage(imgData, 'PNG', 40, position + 40, pdfWidth, pdfHeight);
            heightLeft -= (pageHeight - 80);

            while (heightLeft >= 0) {
                position = heightLeft - pdfHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 40, position + 40, pdfWidth, pdfHeight);
                heightLeft -= pageHeight;
            }

            pdf.save(`${topic.replace(/\s+/g, '_')}_notes.pdf`);
        } catch(e) {
            console.error("Error generating PDF:", e);
            setError("Failed to generate PDF. Please try again.");
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div>
            <form onSubmit={(e) => handleGenerate(e, false)} className="flex flex-col sm:flex-row items-center gap-4">
                <input
                    type="text"
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    placeholder="e.g., The process of cellular respiration"
                    className="flex-grow w-full p-2 border border-gray-600 rounded-lg bg-surface text-onBackground focus:ring-purple-500 focus:border-purple-500"
                />
                <button
                    type="submit"
                    disabled={isGenerating || isExtending || !topic.trim()}
                    className="w-full sm:w-auto px-6 py-2 bg-gradient-to-r from-purple-600 to-purple-500 text-white font-semibold rounded-lg hover:from-purple-500 hover:to-purple-400 transition transform active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    <DocumentTextIcon className="w-5 h-5" />
                    {isGenerating ? 'Generating...' : 'Generate Notes'}
                </button>
            </form>

            {error && <p className="mt-4 text-center text-danger">{error}</p>}
            
            <div ref={notesContainerRef}>
                <AIResponse response={notes} isAnswering={isGenerating} thinkingText="AI is generating your notes...">
                    {notes && (
                        <div className="mt-6 pt-4 border-t border-gray-700 flex flex-col sm:flex-row justify-end gap-4">
                            <button
                                onClick={(e) => handleGenerate(e, true)}
                                disabled={isGenerating || isExtending}
                                className="px-4 py-2 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-500 transition disabled:opacity-50"
                            >
                                {isExtending ? 'Extending...' : 'Extend Notes'}
                            </button>
                            <button
                                onClick={handleDownloadPdf}
                                disabled={isDownloading}
                                className="px-4 py-2 bg-gradient-to-r from-teal-600 to-teal-500 text-white font-semibold rounded-lg hover:from-teal-500 hover:to-teal-400 transition disabled:opacity-50"
                            >
                                {isDownloading ? 'Downloading...' : 'Download as PDF'}
                            </button>
                        </div>
                    )}
                </AIResponse>
            </div>
        </div>
    );
};

export default AINotesGenerator;
