import React, { useRef, useEffect, useState, useLayoutEffect } from 'react';
import { ChevronDownIcon, TrashIcon, EraserIcon } from './icons';

const COLORS = ['#e5e7eb', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7'];
const SIZES = [2, 5, 10, 20];

const Whiteboard: React.FC<{
  onDraw: (data: any) => void;
  initialData: any;
}> = ({ onDraw, initialData }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingData, setDrawingData] = useState<any[]>(initialData || []);
  const [color, setColor] = useState(COLORS[0]);
  const [lineWidth, setLineWidth] = useState(SIZES[0]);
  const [isEraser, setIsEraser] = useState(false);
  const [isSizeDropdownOpen, setSizeDropdownOpen] = useState(false);

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    context.fillStyle = '#1f2937'; // surface color
    context.fillRect(0, 0, canvas.width, canvas.height);

    drawingData.forEach(item => {
        context.globalCompositeOperation = item.isEraser ? 'destination-out' : 'source-over';
        context.beginPath();
        item.points.forEach((p, i) => {
            if (i === 0) {
                context.moveTo(p.x, p.y);
            } else {
                context.lineTo(p.x, p.y);
            }
        });
        context.strokeStyle = item.color;
        context.lineWidth = item.lineWidth;
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.stroke();
        context.closePath();
    });
    context.globalCompositeOperation = 'source-over'; // reset
  };

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
            const { width, height } = entry.contentRect;
            canvas.width = width;
            canvas.height = height;
            redrawCanvas();
        }
    });

    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, [drawingData]);

  useEffect(() => {
    setDrawingData(initialData || []);
    redrawCanvas();
  }, [initialData]);
  
  const currentPath = useRef<any[]>([]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { offsetX, offsetY } = e.nativeEvent;
    setIsDrawing(true);
    currentPath.current = [{x: offsetX, y: offsetY}];
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const { offsetX, offsetY } = e.nativeEvent;
    currentPath.current.push({x: offsetX, y: offsetY});

    const context = canvasRef.current?.getContext('2d');
    if (!context) return;
    
    context.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
    context.beginPath();
    context.moveTo(currentPath.current[0].x, currentPath.current[0].y);
    currentPath.current.forEach(p => context.lineTo(p.x, p.y));
    context.strokeStyle = color;
    context.lineWidth = lineWidth;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.stroke();
    context.closePath();
    context.globalCompositeOperation = 'source-over';
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    
    if (currentPath.current.length > 1) {
        const newPath = {
            points: [...currentPath.current],
            color,
            lineWidth,
            isEraser,
        };
        const newData = [...drawingData, newPath];
        setDrawingData(newData);
        onDraw(newData);
    }
    currentPath.current = [];
  };

  const handleClear = () => {
    setDrawingData([]);
    onDraw([]);
  };

  return (
    <div className="bg-surface rounded-lg shadow-lg p-4 w-full flex flex-col items-center">
      <div className="flex flex-wrap items-center gap-4 mb-4 p-2 rounded-lg bg-background w-full justify-center">
        {/* Color Palette */}
        <div className="flex gap-2 items-center">
          {COLORS.map(c => (
            <button key={c} onClick={() => { setColor(c); setIsEraser(false); }} className={`w-8 h-8 rounded-full transition-transform transform hover:scale-110 ${color === c && !isEraser ? 'ring-2 ring-offset-2 ring-offset-background ring-primary' : ''}`} style={{ backgroundColor: c }} aria-label={`Color ${c}`} />
          ))}
        </div>
        <div className="h-8 w-px bg-gray-600" />
        {/* Brush Size */}
        <div className="relative">
          <button onClick={() => setSizeDropdownOpen(!isSizeDropdownOpen)} className="flex items-center gap-2 p-2 rounded-md hover:bg-gray-700">
            <div className="w-8 h-8 flex items-center justify-center">
                <div className="bg-onSurface rounded-full" style={{ width: lineWidth, height: lineWidth, minWidth: '4px', minHeight: '4px' }}/>
            </div>
            <ChevronDownIcon className="w-5 h-5" />
          </button>
          {isSizeDropdownOpen && (
            <div className="absolute bottom-full mb-2 bg-gray-800 rounded-lg shadow-xl p-2 flex flex-col gap-2 animate-fadeInUp z-10">
              {SIZES.map(s => (
                <button key={s} onClick={() => { setLineWidth(s); setSizeDropdownOpen(false); }} className="w-12 h-12 flex items-center justify-center rounded-md hover:bg-gray-700">
                    <div className="bg-onSurface rounded-full" style={{ width: s, height: s }} />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="h-8 w-px bg-gray-600" />
        {/* Eraser and Clear */}
        <div className="flex gap-2">
            <button onClick={() => setIsEraser(!isEraser)} className={`p-2 rounded-md transition-colors ${isEraser ? 'bg-primary/50 text-white' : 'hover:bg-gray-700'}`} title="Eraser">
                <EraserIcon className="w-6 h-6" />
            </button>
            <button onClick={handleClear} className="p-2 rounded-md hover:bg-danger/20 text-danger transition-colors" title="Clear Canvas">
                <TrashIcon className="w-6 h-6" />
            </button>
        </div>
      </div>
      <div ref={containerRef} className="w-full h-[600px] max-w-full lg:max-w-[800px] border border-gray-600 rounded-md cursor-crosshair">
        <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseOut={handleMouseUp}
        />
      </div>
    </div>
  );
};

export default Whiteboard;
