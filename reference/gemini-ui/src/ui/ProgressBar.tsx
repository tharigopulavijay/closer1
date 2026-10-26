import React from 'react';

interface ProgressBarProps {
  progress: number; // 0 to 100
  color?: string;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  color = '#FFB547',
  className = '',
}) => {
  const clamped = Math.max(0, Math.min(100, progress));
  return (
    <div className={`w-full h-1.5 bg-[#2A1C38] rounded-full overflow-hidden ${className}`}>
      <div
        className="h-full transition-all duration-300 ease-out rounded-full"
        style={{ width: `${clamped}%`, backgroundColor: color }}
      />
    </div>
  );
};
