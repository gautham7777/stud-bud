import React, { useState } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { ShareIcon } from '../icons';

interface ConceptNode {
    topic: string;
    children?: ConceptNode[];
}

const AIConceptMapper: React.FC = () => {
    const [topic, setTopic] = useState('');
    const [mindMapImageUrl, setMindMapImageUrl] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [statusText, setStatusText] = useState('');
    const [zoomLevel, setZoomLevel] = useState(1);

    const generateMindMapImage = async (mapData: ConceptNode) => {
        setStatusText("Now, creating a visual mind map...");

        const mapToString = (node: ConceptNode, level = 0): string => {
            let str = `${'  '.repeat(level)}- ${node.topic}\n`;
            if (node.children) {
                node.children.forEach(child => {
                    str += mapToString(child, level + 1);
                });
            }
            return str;
        };

        const mapDescription = mapToString(mapData);

        const prompt = `Create a visually appealing mind map diagram for the topic "${mapData.topic}".
        The structure is:
        ${mapDescription}

        Style instructions:
        - Use a friendly, hand-drawn, doodle-like aesthetic.
        - Use a soft, vibrant pastel color palette (like light teal, pale orange, soft pink, gentle lavender).
        - Each topic should be inside a rounded, slightly irregular shape (like a colorful blob or rounded rectangle).
        - Connect the nodes with quirky, slightly curved lines and arrows.
        - The layout must be clear, balanced, and spread out horizontally from the center.
        - The background should be a clean, off-white or very light cream color.
        - The text should be in a clear, friendly, handwritten-style font.
        - High resolution, clean vector style illustration.`;

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const response = await ai.models.generateImages({
                model: 'imagen-4.0-generate-001',
                prompt: prompt,
                config: {
                    numberOfImages: 1,
                    outputMimeType: 'image/png',
                },
            });

            const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
            const url = `data:image/png;base64,${base64ImageBytes}`;
            setMindMapImageUrl(url);
            setStatusText('');
        } catch (err) {
            console.error("Error generating mind map image:", err);
            setStatusText("Failed to create the visual mind map. Please try again.");
        }
    };


    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!topic.trim()) return;
        setIsGenerating(true);
        setMindMapImageUrl(null);
        setStatusText('AI is mapping out concepts...');
        
        try {
            // Step 1: Generate the JSON structure for the map
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const prompt = `Generate a hierarchical concept map for the topic: "${topic}". The output should be a nested JSON object. The root object should have a "topic" string property and an optional "children" array of similar objects. Keep the hierarchy to a maximum of 3 levels deep.`;
            
            const geminiResponse = await ai.models.generateContent({
                model: "gemini-flash-lite-latest",
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            topic: { type: Type.STRING },
                            children: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        topic: { type: Type.STRING },
                                        children: {
                                            type: Type.ARRAY,
                                            items: {
                                                type: Type.OBJECT,
                                                properties: {
                                                    topic: { type: Type.STRING },
                                                     children: {
                                                        type: Type.ARRAY,
                                                        items: {
                                                            type: Type.OBJECT,
                                                            properties: {
                                                                topic: { type: Type.STRING }
                                                            },
                                                            required: ["topic"]
                                                        }
                                                    }
                                                },
                                                required: ["topic"]
                                            }
                                        }
                                    },
                                    required: ["topic"]
                                }
                            }
                        },
                        required: ["topic"]
                    }
                }
            });
            const result = JSON.parse(geminiResponse.text);
            
            // Step 2: Generate the image from the structure
            await generateMindMapImage(result);

        } catch (err) {
            console.error("Error generating concept map:", err);
            setStatusText("Sorry, I couldn't generate a map for that topic. Please try a broader topic or rephrase.");
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
                    placeholder="Enter a central topic, e.g., Photosynthesis"
                    className="flex-grow w-full p-2 border border-gray-600 rounded-lg bg-surface text-onBackground focus:ring-violet-500 focus:border-violet-500"
                />
                <button type="submit" disabled={isGenerating || !topic.trim()} className="w-full sm:w-auto px-6 py-2 bg-gradient-to-r from-violet-600 to-violet-500 text-white font-semibold rounded-lg hover:from-violet-500 hover:to-violet-400 transition transform active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
                    <ShareIcon className="w-5 h-5"/>
                    {isGenerating ? 'Generating...' : 'Generate Map'}
                </button>
            </form>
            
            {(isGenerating || statusText) && <div className="mt-4 text-center text-onSurface">{statusText}</div>}

            {mindMapImageUrl && (
                <div className="mt-6 p-4 bg-surface/50 border border-gray-700 rounded-lg animate-fadeInUp text-center">
                    <div className="overflow-auto cursor-zoom-in relative h-[60vh] bg-background rounded-md flex items-center justify-center p-2">
                        <img
                            src={mindMapImageUrl}
                            alt={`Mind map for ${topic}`}
                            className="transition-transform duration-300 ease-in-out max-w-none max-h-full"
                            style={{ transform: `scale(${zoomLevel})` }}
                        />
                    </div>
                    <div className="mt-4 flex justify-center items-center gap-4">
                        <button onClick={() => setZoomLevel(z => Math.max(0.2, z - 0.1))} className="px-4 py-2 bg-gray-600 text-onBackground rounded-md font-bold text-lg hover:bg-gray-500 transition-colors">-</button>
                        <span className="font-semibold text-onSurface w-16">{Math.round(zoomLevel * 100)}%</span>
                        <button onClick={() => setZoomLevel(z => Math.min(3, z + 0.1))} className="px-4 py-2 bg-gray-600 text-onBackground rounded-md font-bold text-lg hover:bg-gray-500 transition-colors">+</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AIConceptMapper;
