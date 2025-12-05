import { cn } from '@/lib/utils';

interface PageContainerProps {
  children: React.ReactNode;
  size?: 'narrow' | 'default' | 'wide';
  className?: string;
}

const sizeClasses = {
  narrow: 'max-w-md',
  default: 'max-w-2xl',
  wide: 'max-w-7xl',
};

export function PageContainer({
  children,
  size = 'wide',
  className,
}: PageContainerProps) {
  return (
    <div
      className={cn(
        'mx-auto w-full px-4 py-8 sm:px-6 sm:py-12 lg:px-8',
        sizeClasses[size],
        className
      )}
    >
      {children}
    </div>
  );
}
