import React, { useState } from 'react';
import { GoogleGenAI, GroundingChunk } from "@google/genai";
import { AIResponse } from './common';
import { DocumentDuplicateIcon } from '../icons';

const AIResearchAssistant: React.FC = () => {
    const [topic, setTopic] = useState('');
    const [result, setResult] = useState('');
    const [sources, setSources] = useState<GroundingChunk[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [error, setError] = useState('');
    const [copySuccess, setCopySuccess] = useState('');

    const handleCopy = () => {
        if (!result) return;
        navigator.clipboard.writeText(result).then(() => {
            setCopySuccess('Copied!');
            setTimeout(() => setCopySuccess(''), 2000);
        }, (err) => {
            setCopySuccess('Failed to copy');
            console.error('Could not copy text: ', err);
            setTimeout(() => setCopySuccess(''), 2000);
        });
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!topic.trim()) return;
        setIsSearching(true);
        setResult('');
        setSources([]);
        setError('');
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const responseStream = await ai.models.generateContentStream({
                model: "gemini-flash-lite-latest",
                contents: `Provide a detailed summary and answer for the research topic: "${topic}".`,
                config: {
                    tools: [{ googleSearch: {} }],
                },
            });

            let streamedText = "";
            let groundingChunks: GroundingChunk[] = [];
            for await (const chunk of responseStream) {
                streamedText += chunk.text;
                setResult(streamedText);

                const currentChunkGrounding = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
                if (currentChunkGrounding && currentChunkGrounding.length > 0) {
                    groundingChunks = currentChunkGrounding;
                    setSources(groundingChunks); // set sources as soon as we get them
                }
            }

        } catch (err) {
            console.error("Error with Research Assistant:", err);
            setError("Sorry, an error occurred during the search. Please try again.");
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <div>
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row items-center gap-4">
                <input
                    type="text"
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    placeholder="Enter a research topic, e.g., 'The impact of AI on education'"
                    className="flex-grow w-full p-2 border border-gray-600 rounded-lg bg-surface text-onBackground focus:ring-rose-500 focus:border-rose-500"
                />
                <button type="submit" disabled={isSearching || !topic.trim()} className="w-full sm:w-auto px-6 py-2 bg-gradient-to-r from-rose-600 to-rose-500 text-white font-semibold rounded-lg hover:from-rose-500 hover:to-rose-400 transition transform active:scale-95 disabled:opacity-50">
                    {isSearching ? 'Researching...' : 'Research'}
                </button>
            </form>
            {error && <p className="mt-4 text-center text-danger">{error}</p>}

            <AIResponse response={result} isAnswering={isSearching} thinkingText="AI is researching your topic...">
                {result && (
                     <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-700">
                        {sources.length > 0 && (
                            <div>
                                <h4 className="font-bold text-onBackground mb-2">Sources:</h4>
                                <ul className="list-disc pl-5 space-y-1">
                                    {sources.map((source, index) => (
                                        <li key={index} className="text-sm">
                                            <a href={source.web?.uri} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline break-all">
                                                {source.web?.title || source.web?.uri}
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        <button onClick={handleCopy} className="flex items-center gap-2 px-3 py-1 text-sm bg-gray-700 text-onSurface rounded-md hover:bg-gray-600 transition ml-auto self-start">
                            <DocumentDuplicateIcon className="w-4 h-4" />
                            {copySuccess || 'Copy'}
                        </button>
                    </div>
                )}
            </AIResponse>
        </div>
    );
};

export default AIResearchAssistant;