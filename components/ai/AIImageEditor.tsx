import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { PencilAltIcon } from '../icons';

const AIImageEditor: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState('');

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt.trim()) return;

        setIsGenerating(true);
        setGeneratedImageUrl(null);
        setError('');

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            // Guide the AI to create educational content
            const fullPrompt = `Generate an educational diagram or illustration for a student's notes on the topic: "${prompt}"`;
            
            const response = await ai.models.generateImages({
                model: 'imagen-4.0-generate-001',
                prompt: fullPrompt,
                config: {
                  numberOfImages: 1,
                  outputMimeType: 'image/png',
                },
            });

            const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
            const url = `data:image/png;base64,${base64ImageBytes}`;
            setGeneratedImageUrl(url);

        } catch (err) {
            console.error("Error generating diagram:", err);
            setError("Sorry, I couldn't create a visual for that. It might be too complex or against the safety policy.");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div>
            <p className="text-onSurface mb-4 text-center">Describe the diagram or illustration you need for your notes, and the AI will create it for you.</p>

            <form onSubmit={handleGenerate} className="flex flex-col sm:flex-row items-center gap-4">
                <input
                    type="text"
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    placeholder="e.g., A diagram of the water cycle with labels"
                    className="flex-grow w-full p-2 border border-gray-600 rounded-lg bg-surface text-onBackground focus:ring-cyan-500 focus:border-cyan-500"
                />
                <button
                    type="submit"
                    disabled={isGenerating || !prompt.trim()}
                    className="w-full sm:w-auto px-6 py-2 bg-gradient-to-r from-cyan-600 to-cyan-500 text-white font-semibold rounded-lg hover:from-cyan-500 hover:to-cyan-400 transition transform active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    <PencilAltIcon className="w-5 h-5" />
                    {isGenerating ? 'Generating...' : 'Generate Visual'}
                </button>
            </form>

            {error && <p className="mt-4 text-center text-danger">{error}</p>}

            {isGenerating && <div className="mt-4 text-center text-onSurface">AI is creating your visual... This may take a moment.</div>}

            {generatedImageUrl && (
                <div className="mt-6 animate-fadeInUp">
                    <h3 className="text-lg font-bold text-onBackground mb-2 text-center">Result:</h3>
                    <div className="flex justify-center p-4 bg-background rounded-lg">
                        <img src={generatedImageUrl} alt="Generated diagram or illustration" className="max-h-96 rounded-lg shadow-lg" />
                    </div>
                </div>
            )}
        </div>
    );
};

export default AIImageEditor;