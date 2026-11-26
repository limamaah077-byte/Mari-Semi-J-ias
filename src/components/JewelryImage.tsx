import { useState } from 'react';
import { Gem } from 'lucide-react';
import { isSafeImageUrl } from '../utils/format';

interface JewelryImageProps {
  src?: string;
  alt: string;
  className?: string;
}

export function JewelryImage({ src, alt, className = '' }: JewelryImageProps) {
  const [failed, setFailed] = useState(false);

  if (!isSafeImageUrl(src) || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#F4ECE6] via-[#F9EFF0] to-[#EFE5DD] text-[#9B726C] ${className}`}
        role="img"
        aria-label={alt}
      >
        <Gem className="w-8 h-8 opacity-60 mb-2" strokeWidth={1.25} />
        <span className="text-xs font-medium tracking-wide px-4 text-center line-clamp-2 opacity-80">
          {alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
