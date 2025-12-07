import Image from 'next/image';
import { cn } from '@/lib/utils';

export function Logo({
  className,
  textClassName,
  size = 40,
  hideText,
  text = 'CloudAI Academy',
}: {
  className?: string;
  textClassName?: string;
  size?: number;
  hideText?: boolean;
  text?: string;
}) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Image
        src="/images/logo.png"
        alt="CloudAI Academy logo"
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="object-contain"
        priority
      />
      {!hideText && (
        <span
          className={cn(
            'font-headline text-xl font-bold',
            textClassName || 'text-primary'
          )}
        >
          {text}
        </span>
      )}
    </div>
  );
}
