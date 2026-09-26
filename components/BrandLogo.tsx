import Image from 'next/image';
import { COMPANY } from '@/lib/company';

import logo from '@/public/brand/logo.png';
import logoDark from '@/public/brand/logo-dark.png';
import mark from '@/public/brand/mark.png';
import markDark from '@/public/brand/mark-dark.png';

interface BrandLogoProps {
  /** 'full' = mark + M.D.S wordmark, 'mark' = icon only */
  variant?: 'full' | 'mark';
  /** Wrapper classes — use these for responsive visibility (e.g. 'hidden sm:block'). */
  className?: string;
  /** Image size classes. */
  imgClassName?: string;
  priority?: boolean;
}

// Renders both colourways; only the one matching the active theme is shown.
// Theme switching lives on the <img> elements and responsive visibility on the
// wrapper, so the two never override each other.
export default function BrandLogo({
  variant = 'full',
  className = '',
  imgClassName = 'h-10 w-auto',
  priority,
}: BrandLogoProps) {
  const [light, dark] = variant === 'full' ? [logo, logoDark] : [mark, markDark];
  const alt = COMPANY.legalName;
  return (
    <span className={className}>
      <Image src={light} alt={alt} priority={priority} className={`${imgClassName} block dark:hidden`} />
      <Image src={dark} alt={alt} priority={priority} className={`${imgClassName} hidden dark:block`} />
    </span>
  );
}
