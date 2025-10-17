import React, { useRef, useEffect, useState } from 'react';

interface WhiteboardProps {
  width: number;
  height: number;
  onDraw: (data: any) => void;
  initialData: any;
}

const Whiteboard: React.FC<WhiteboardProps> = ({ width, height, onDraw, initialData }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingData, setDrawingData] = useState<any[]>(initialData || []);

  const drawLine = (
    ctx: CanvasRenderingContext2D,
    x0: number, y0: number, x1: number, y1: number,
    color: string = '#e5e7eb', // Default to light gray for dark mode
    emit: boolean = false
  ) => {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.closePath();

    if (!emit) return;
    const newData = [...drawingData, { x0, y0, x1, y1, color }];
    setDrawingData(newData);
    onDraw(newData);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    
    // Clear with a fill to ensure background is not transparent
    context.fillStyle = '#1f2937'; // surface color
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    drawingData.forEach(data => {
        drawLine(context, data.x0, data.y0, data.x1, data.y1, data.color);
    });

  }, [drawingData, width, height]);

  useEffect(() => {
    setDrawingData(initialData || []);
  }, [initialData]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { offsetX, offsetY } = e.nativeEvent;
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (context) {
        context.beginPath();
        context.moveTo(offsetX, offsetY);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const { offsetX, offsetY, movementX, movementY } = e.nativeEvent;
    drawLine(
        canvasRef.current!.getContext('2d')!,
        offsetX - movementX,
        offsetY - movementY,
        offsetX,
        offsetY,
        '#e5e7eb',
        true
    );
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const handleClear = () => {
    setDrawingData([]);
    onDraw([]);
  }

  return (
    <div className="bg-surface rounded-lg shadow-lg p-4">
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="border border-gray-600 rounded-md cursor-crosshair"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseOut={handleMouseUp}
        />
        <button onClick={handleClear} className="mt-2 px-4 py-2 bg-danger text-white font-semibold rounded-md hover:bg-rose-500 transition">Clear</button>
    </div>
  );
};

export default Whiteboard;