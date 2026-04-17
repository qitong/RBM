import React, { useState, useCallback, useRef, useEffect } from 'react';

interface ResizableLayoutProps {
  children: [React.ReactNode, React.ReactNode];
  initialRatio?: number; // 0 to 100
  minRatio?: number;
  maxRatio?: number;
  className?: string;
}

export default function ResizableLayout({ 
  children, 
  initialRatio = 66, 
  minRatio = 20, 
  maxRatio = 80,
  className = "" 
}: ResizableLayoutProps) {
  const [leftWidth, setLeftWidth] = useState(initialRatio);
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const onMouseDown = useCallback(() => {
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
    
    if (newLeftWidth >= minRatio && newLeftWidth <= maxRatio) {
      setLeftWidth(newLeftWidth);
    }
  }, [minRatio, maxRatio]);

  const onMouseUp = useCallback(() => {
    isDragging.current = false;
    document.body.style.cursor = 'default';
    document.body.style.userSelect = 'auto';
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  return (
    <div ref={containerRef} className={`flex w-full gap-1 overflow-hidden ${className}`}>
      <div style={{ width: `${leftWidth}%` }} className="flex-shrink-0">
        {children[0]}
      </div>
      
      {/* Draggable Gutter */}
      <div 
        onMouseDown={onMouseDown}
        className="w-1.5 hover:w-2 bg-slate-200 hover:bg-primary-400 cursor-col-resize transition-all duration-150 rounded-full my-4 self-stretch flex-shrink-0 z-10"
        title="拖拽调整宽度"
      />

      <div style={{ width: `${100 - leftWidth}%` }} className="flex-grow">
        {children[1]}
      </div>
    </div>
  );
}
