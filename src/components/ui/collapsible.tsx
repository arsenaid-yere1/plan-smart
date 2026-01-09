'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollapsibleProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
  onEdit?: () => void;
  id?: string;
}

export function Collapsible({
  title,
  defaultOpen = true,
  children,
  className,
  onEdit,
  id,
}: CollapsibleProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  // Generate stable IDs for accessibility
  const generatedId = React.useId();
  const baseId = id || generatedId;
  const headerId = `${baseId}-header`;
  const contentId = `${baseId}-content`;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen(!isOpen);
    }
  };

  return (
    <div className={cn('border rounded-lg', className)}>
      <div
        id={headerId}
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        aria-controls={contentId}
        className="flex items-center justify-between p-4 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-t-lg"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
      >
        <h3 className="font-medium">{title}</h3>
        <div className="flex items-center gap-2">
          {onEdit && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              onKeyDown={(e) => e.stopPropagation()}
              aria-label={`Edit ${title}`}
              className="text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded px-1"
            >
              Edit
            </button>
          )}
          <ChevronDown
            aria-hidden="true"
            className={cn(
              'h-4 w-4 transition-transform duration-200',
              isOpen && 'rotate-180'
            )}
          />
        </div>
      </div>
      <div
        id={contentId}
        role="region"
        aria-labelledby={headerId}
        hidden={!isOpen}
      >
        {isOpen && <div className="px-4 pb-4">{children}</div>}
      </div>
    </div>
  );
}
