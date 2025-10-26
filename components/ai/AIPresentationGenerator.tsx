import React, { useState, useRef } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { PresentationChartBarIcon } from '../icons';

declare global {
    interface Window {
        jspdf: any;
        html2canvas: any;
    }
}

interface Slide {
    title: string;
    points: string[];
}

const AIPresentationGenerator: React.FC = () => {
    const [topic, setTopic] = useState('');
    const [slides, setSlides] = useState<Slide[] | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [error, setError] = useState('');
    const slidesContainerRef = useRef<HTMLDivElement>(null);

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!topic.trim()) return;
        setIsGenerating(true);
        setSlides(null);
        setError('');
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const prompt = `Generate a 5-slide presentation for the topic: "${topic}". Each slide should have a title and 3-5 concise bullet points.`;
            
            const geminiResponse = await ai.models.generateContent({
                model: "gemini-flash-lite-latest",
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            slides: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        title: { type: Type.STRING },
                                        points: { type: Type.ARRAY, items: { type: Type.STRING } }
                                    },
                                    required: ["title", "points"]
                                }
                            }
                        },
                        required: ["slides"]
                    }
                }
            });

            const result = JSON.parse(geminiResponse.text);
            if (result && result.slides && Array.isArray(result.slides) && result.slides.length > 0) {
                setSlides(result.slides);
            } else {
                throw new Error("AI returned no slides.");
            }
        } catch (err) {
            console.error("Error generating presentation:", err);
            setError("Sorry, I couldn't generate a presentation for that topic. Please try again.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownloadPdf = async () => {
        if (!slidesContainerRef.current || !slides) return;
        setIsDownloading(true);

        try {
            const { jsPDF } = window.jspdf;
            // PDF will be in landscape, 16:9 aspect ratio
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'px',
                format: [960, 540] 
            });

            const slideElements = Array.from(slidesContainerRef.current.children) as HTMLElement[];

            for (let i = 0; i < slideElements.length; i++) {
                const slide = slideElements[i];
                const canvas = await window.html2canvas(slide, { 
                    scale: 2, // Higher scale for better resolution
                    useCORS: true,
                    backgroundColor: '#1f2937' // Match slide background
                });
                const imgData = canvas.toDataURL('image/png');
                
                if (i > 0) {
                    pdf.addPage([960, 540], 'landscape');
                }
                
                pdf.addImage(imgData, 'PNG', 0, 0, 960, 540);
            }

            pdf.save(`${topic.replace(/\s+/g, '_')}_presentation.pdf`);
        } catch(e) {
            console.error("Error generating PDF:", e);
            setError("Failed to generate PDF. Please try again.");
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div>
            <form onSubmit={handleGenerate} className="flex flex-col sm:flex-row items-center gap-4">
                <input
                    type="text"
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    placeholder="Enter a topic for your presentation..."
                    className="flex-grow w-full p-2 border border-gray-600 rounded-lg bg-surface text-onBackground focus:ring-orange-500 focus:border-orange-500"
                />
                <button type="submit" disabled={isGenerating || !topic.trim()} className="w-full sm:w-auto px-6 py-2 bg-gradient-to-r from-orange-600 to-orange-500 text-white font-semibold rounded-lg hover:from-orange-500 hover:to-orange-400 transition transform active:scale-95 disabled:opacity-50">
                    {isGenerating ? 'Generating...' : 'Generate Presentation'}
                </button>
            </form>
            
            {isGenerating && <div className="mt-4 text-center text-onSurface">AI is building your presentation...</div>}
            {error && <p className="mt-4 text-center text-danger">{error}</p>}
            
            {slides && (
                <div className="my-6 flex justify-center animate-fadeInUp">
                    <button 
                        onClick={handleDownloadPdf} 
                        disabled={isDownloading}
                        className="px-6 py-2 bg-gradient-to-r from-green-600 to-green-500 text-white font-semibold rounded-lg hover:from-green-500 hover:to-green-400 transition transform active:scale-95 disabled:opacity-50"
                    >
                        {isDownloading ? 'Downloading PDF...' : 'Download as PDF'}
                    </button>
                </div>
            )}
            
            {slides && (
                <div ref={slidesContainerRef} className="mt-6 space-y-4 animate-fadeInUp">
                    {slides.map((slide, index) => (
                        <div key={index} className="w-full aspect-video p-8 border border-gray-700 bg-surface rounded-lg shadow-lg flex flex-col justify-center items-center text-center overflow-hidden">
                            <div className="flex-grow flex flex-col justify-center">
                                <h3 className="font-bold text-3xl md:text-4xl text-orange-400 mb-6">{slide.title}</h3>
                                <ul className="text-lg md:text-2xl text-onSurface space-y-3">
                                    {slide.points.map((point, pIndex) => (
                                        <li key={pIndex}>- {point}</li>
                                    ))}
                                </ul>
                            </div>
                            <p className="text-sm text-gray-400 mt-auto">{index + 1} / {slides.length}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AIPresentationGenerator;