import React, { useState, useMemo } from 'react';
import { UserMark } from '../../types';
import { TrashIcon, ChevronDownIcon } from '../icons';

// --- Helper Functions & Components ---

const getBarColor = (percentage: number): string => {
    if (percentage >= 90) return 'from-teal-400 to-green-500';
    if (percentage >= 80) return 'from-sky-400 to-blue-500';
    if (percentage >= 70) return 'from-amber-400 to-yellow-500';
    if (percentage >= 60) return 'from-orange-500 to-red-500';
    return 'from-rose-500 to-danger';
};

const PIE_CHART_COLORS = ['#3b82f6', '#10b981', '#f97316', '#ec4899', '#8b5cf6', '#06b6d4', '#f59e0b', '#ef4444'];

const PieChart: React.FC<{
    data: { name: string; value: number; color: string }[];
    overallPercentage: number;
    subjectAverages: { subjectName: string; percentage: number }[];
}> = ({ data, overallPercentage, subjectAverages }) => {
    
    let cumulativePercentage = 0;
    const totalValue = data.reduce((sum, i) => sum + i.value, 0);
    const gradientParts = data.map(item => {
        const percentage = (item.value / totalValue) * 100;
        const start = cumulativePercentage;
        cumulativePercentage += percentage;
        const end = cumulativePercentage;
        return `${item.color} ${start}% ${end}%`;
    }).join(', ');

    const conicGradient = `conic-gradient(${gradientParts})`;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center w-full max-w-4xl mx-auto">
            <div className="flex items-center justify-center">
                <div className="relative">
                    <div
                        className="w-48 h-48 rounded-full transition-all duration-1000 ease-out"
                        style={{ background: conicGradient, filter: `drop-shadow(0 0 10px rgba(128, 128, 128, 0.2))` }}
                    >
                    </div>
                    <div className="absolute inset-4 bg-surface rounded-full flex items-center justify-center">
                        <div className="text-center">
                            <p className="text-4xl font-bold text-onBackground">{Math.round(overallPercentage)}<span className="text-2xl opacity-70">%</span></p>
                            <p className="text-sm text-onSurface uppercase tracking-wider">Overall</p>
                        </div>
                    </div>
                </div>
            </div>
            <div className="w-full space-y-3">
                <h3 className="font-semibold text-onBackground text-lg mb-3 text-center md:text-left">Subject Averages</h3>
                {data.map(item => {
                    const avg = subjectAverages.find(s => s.subjectName === item.name)?.percentage || 0;
                    return (
                        <div key={item.name} className="text-sm">
                             <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                                    <span className="font-medium text-onSurface">{item.name}</span>
                                </div>
                                <span className="font-semibold text-onBackground">{avg.toFixed(0)}%</span>
                            </div>
                            <div className="w-full bg-surface rounded-full h-1.5">
                                <div className="h-1.5 rounded-full" style={{ width: `${avg}%`, backgroundColor: item.color }}></div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// --- Main Component ---

const MarksGraph: React.FC<{ marks: UserMark[], onDeleteMark: (markId: string) => void }> = ({ marks, onDeleteMark }) => {
    const [expandedSubject, setExpandedSubject] = useState<string | null>(null);
    if (marks.length === 0) return null;

    // Memoize calculations
    const { overallPercentage, marksBySubject, subjectAverages, pieChartData } = useMemo(() => {
        const totalObtained = marks.reduce((sum, mark) => sum + mark.marksObtained, 0);
        const totalPossible = marks.reduce((sum, mark) => sum + mark.totalMarks, 0);
        const overallPercentage = totalPossible > 0 ? (totalObtained / totalPossible) * 100 : 0;

        const marksBySubject = marks.reduce((acc, mark) => {
            const subject = mark.subjectName;
            if (!acc[subject]) {
                acc[subject] = [];
            }
            acc[subject].push(mark);
            return acc;
        }, {} as { [key: string]: UserMark[] });

        const subjectAverages = Object.entries(marksBySubject).map(([subjectName, subjectMarks]) => {
            const subjectTotalObtained = subjectMarks.reduce((sum, mark) => sum + mark.marksObtained, 0);
            const subjectTotalPossible = subjectMarks.reduce((sum, mark) => sum + mark.totalMarks, 0);
            const percentage = subjectTotalPossible > 0 ? (subjectTotalObtained / subjectTotalPossible) * 100 : 0;
            return { subjectName, percentage };
        });

        const pieChartData = Object.entries(marksBySubject).map(([subjectName, subjectMarks], index) => {
            const subjectTotalPossible = subjectMarks.reduce((sum, mark) => sum + mark.totalMarks, 0);
            return {
                name: subjectName,
                value: subjectTotalPossible,
                color: PIE_CHART_COLORS[index % PIE_CHART_COLORS.length]
            };
        }).filter(item => item.value > 0);

        return { overallPercentage, marksBySubject, subjectAverages, pieChartData };
    }, [marks]);


    const handleToggleSubject = (subjectName: string) => {
        setExpandedSubject(prev => prev === subjectName ? null : subjectName);
    };

    return (
        <div className="space-y-8">
            <div className="bg-surface/50 p-4 rounded-xl border border-gray-700 flex justify-center">
                <PieChart data={pieChartData} overallPercentage={overallPercentage} subjectAverages={subjectAverages} />
            </div>
            
            <div className="space-y-4">
                <h3 className="font-semibold text-onBackground text-xl px-4">Detailed Breakdown</h3>
                {Object.entries(marksBySubject).map(([subjectName, subjectMarks]) => {
                    const isExpanded = expandedSubject === subjectName;
                    const subjectAvg = subjectAverages.find(s => s.subjectName === subjectName)?.percentage || 0;

                    return (
                        <div key={subjectName} className="bg-surface/50 rounded-lg overflow-hidden transition-all duration-300 border border-gray-700/50">
                            <button 
                                onClick={() => handleToggleSubject(subjectName)}
                                className="w-full flex items-center justify-between p-4 text-left"
                            >
                                <div className="flex items-center gap-4 flex-1">
                                    <div className={`w-2 h-6 rounded-full bg-gradient-to-b ${getBarColor(subjectAvg)}`}></div>
                                    <span className="font-bold text-lg text-onBackground">{subjectName}</span>
                                    <span className={`text-sm font-semibold px-2 py-0.5 rounded-full bg-gray-700/80`}>{subjectAvg.toFixed(1)}%</span>
                                </div>
                                <ChevronDownIcon className={`w-6 h-6 text-onSurface ml-4 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>
                            
                            {isExpanded && (
                                <div className="px-4 pb-4 border-t border-gray-700 animate-fadeInUp grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div>
                                        <h4 className="font-semibold text-onBackground mt-4 mb-4">Exam Performance</h4>
                                        <div className="h-72 p-4 bg-background rounded-lg flex items-end justify-around gap-2 border border-gray-700 relative">
                                            {['', '25%', '50%', '75%', '100%'].map((label, i) => (
                                                <div key={label} className="absolute left-0 w-full flex items-center" style={{ bottom: `${i * 25}%`}}>
                                                   <span className="text-xs text-gray-500 -ml-8">{label}</span>
                                                   <div className="flex-1 border-t border-gray-700/50 border-dashed"></div>
                                                </div>
                                            ))}
                                            {subjectMarks.map(mark => {
                                                const percentage = (mark.marksObtained / mark.totalMarks) * 100;
                                                return (
                                                    <div key={mark.id} className="h-full w-8 flex-shrink-0 flex flex-col justify-end items-center group relative">
                                                        <div className="absolute -top-10 hidden group-hover:block bg-gray-900 text-white text-xs rounded py-1 px-2 z-10 whitespace-nowrap shadow-lg animate-fadeInUp">
                                                            {mark.examName}<br/>
                                                            <span className="font-bold">{mark.marksObtained}/{mark.totalMarks} ({percentage.toFixed(1)}%)</span>
                                                        </div>
                                                        <div
                                                            className={`w-full rounded-t-md bg-gradient-to-b ${getBarColor(percentage)} transition-all duration-500 ease-out hover:opacity-100 opacity-80`}
                                                            style={{ height: `${percentage}%` }}
                                                        ></div>
                                                        <div className="h-12 flex items-center justify-center">
                                                          <span className="text-xs text-onSurface text-center break-words w-full" title={mark.examName}>{mark.examName}</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <h4 className="font-semibold text-onBackground mt-4 mb-4">History</h4>
                                        <div className="max-h-72 overflow-y-auto pr-2 bg-background rounded-lg p-2 border border-gray-700">
                                            {subjectMarks.sort((a,b) => b.createdAt - a.createdAt).map(mark => (
                                                <div key={mark.id} className="flex flex-wrap items-center justify-between p-1.5 rounded-md hover:bg-gray-800/50 text-sm">
                                                    <p className="text-onSurface truncate pr-2">{mark.examName}</p>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-onBackground text-center w-20">{mark.marksObtained} / {mark.totalMarks}</span>
                                                        <button onClick={() => onDeleteMark(mark.id)} className="p-1 text-danger/70 hover:text-danger hover:bg-danger/10 rounded-full transition">
                                                            <TrashIcon className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default MarksGraph;