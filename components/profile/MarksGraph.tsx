
import React from 'react';
import { UserMark } from '../../types';

const normalizeMark = (markStr: string): number => {
    const mark = markStr.trim().toUpperCase();
    
    // Handle percentages
    if (mark.includes('%')) {
        return parseFloat(mark.replace('%', '')) || 0;
    }
    
    // Handle letter grades (simplified scale)
    const gradeMap: { [key: string]: number } = {
        'A+': 97, 'A': 93, 'A-': 90,
        'B+': 87, 'B': 83, 'B-': 80,
        'C+': 77, 'C': 73, 'C-': 70,
        'D+': 67, 'D': 63, 'D-': 60,
    };
    if (gradeMap[mark]) return gradeMap[mark];

    // Handle GPA (out of 4.0 or 5.0)
    const num = parseFloat(mark);
    if (!isNaN(num)) {
        if (num <= 5.0) return (num / 4.0) * 100; // Assuming 4.0 scale
        return num; // Assume out of 100
    }
    
    return 0; // Default for non-numeric/unrecognized grades
};

const getBarColor = (value: number): string => {
    if (value >= 90) return 'from-teal-500 to-green-500';
    if (value >= 80) return 'from-sky-500 to-blue-500';
    if (value >= 70) return 'from-amber-500 to-yellow-500';
    if (value >= 60) return 'from-orange-500 to-red-500';
    return 'from-rose-600 to-danger';
};

const MarksGraph: React.FC<{ marks: UserMark[] }> = ({ marks }) => {
    // To prevent duplicate subjects on the graph, we only show the most recent mark per subject
    const latestMarksBySubject = marks.reduce((acc, current) => {
        if (!acc[current.subjectId] || current.createdAt > acc[current.subjectId].createdAt) {
            acc[current.subjectId] = current;
        }
        return acc;
    }, {} as { [key: number]: UserMark });

    const processedMarks = Object.values(latestMarksBySubject);
    
    if (processedMarks.length === 0) return null;

    return (
        <div className="space-y-4 p-4 bg-background rounded-lg">
            <h3 className="font-semibold text-onBackground text-lg">Performance Overview</h3>
            {processedMarks.map((mark, index) => {
                const normalizedValue = normalizeMark(mark.marks);
                const color = getBarColor(normalizedValue);

                return (
                    <div key={mark.id} className="animate-fadeInUp" style={{ animationDelay: `${index * 100}ms`, opacity: 0 }}>
                        <div className="flex justify-between items-center mb-1 text-sm">
                            <span className="font-medium text-onSurface">{mark.subjectName}</span>
                            <span className="font-semibold text-onBackground">{mark.marks}</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
                            <div
                                className={`h-4 rounded-full bg-gradient-to-r ${color} transition-all duration-1000 ease-out`}
                                style={{ width: `${normalizedValue}%` }}
                            ></div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default MarksGraph;
