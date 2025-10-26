import React, { useState, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { AIResponse } from './common';
import { CameraIcon, XCircleIcon } from '../icons';

const fileToGenerativePart = async (file: File) => {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });
  return {
    inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
  };
};

const AIProblemSolver: React.FC = () => {
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [solution, setSolution] = useState('');
    const [isSolving, setIsSolving] = useState(false);
    const [error, setError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
            setError('');
            setSolution('');
        }
    };
    
    const cancelImage = () => {
        setImageFile(null);
        setImagePreview(null);
        if(fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleSolve = async () => {
        if (!imageFile) return;
        setIsSolving(true);
        setSolution('');
        setError('');
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const imagePart = await fileToGenerativePart(imageFile);
            const textPart = { text: "Solve the problem in the image. Provide a clear, step-by-step solution. Use markdown for formatting." };
            
            const responseStream = await ai.models.generateContentStream({
                model: 'gemini-flash-lite-latest',
                contents: { parts: [imagePart, textPart] },
            });

            let streamedText = "";
            for await (const chunk of responseStream) {
                streamedText += chunk.text;
                setSolution(streamedText);
            }

        } catch (err) {
            console.error("Error solving problem:", err);
            setError("Sorry, I couldn't solve this problem. Please ensure the image is clear and try again.");
        } finally {
            setIsSolving(false);
        }
    };

    return (
        <div>
            <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-600 rounded-lg bg-surface">
                {imagePreview ? (
                    <div className="relative">
                        <img src={imagePreview} alt="Problem preview" className="max-h-80 rounded-lg" />
                        <button onClick={cancelImage} className="absolute top-2 right-2 bg-black/50 rounded-full text-white">
                            <XCircleIcon className="w-8 h-8"/>
                        </button>
                    </div>
                ) : (
                    <div className="text-center">
                        <CameraIcon className="w-16 h-16 mx-auto text-gray-500" />
                        <p className="mt-2 text-onSurface">Upload or take a picture of a problem.</p>
                    </div>
                )}
                <input type="file" accept="image/*" capture="environment" onChange={handleFileChange} ref={fileInputRef} className="hidden" />
                <div className="mt-4 flex gap-4">
                    <button onClick={() => fileInputRef.current?.click()} className="px-6 py-2 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-500 transition">
                        Upload Image
                    </button>
                    <button onClick={handleSolve} disabled={!imageFile || isSolving} className="px-6 py-2 bg-gradient-to-r from-cyan-600 to-cyan-500 text-white font-semibold rounded-lg hover:from-cyan-500 hover:to-cyan-400 transition transform active:scale-95 disabled:opacity-50">
                        {isSolving ? 'Solving...' : 'Solve Problem'}
                    </button>
                </div>
            </div>
            {error && <p className="mt-4 text-center text-danger">{error}</p>}

            <AIResponse response={solution} isAnswering={isSolving} thinkingText="AI is analyzing the problem..." />
        </div>
    );
};

export default AIProblemSolver;