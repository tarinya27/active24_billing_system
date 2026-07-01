import { cn } from '../../utils/helpers';

export default function BrandLogo({ className, alt = 'Active24' }) {
  return (
    <img
      src="/active24-logo.png"
      alt={alt}
      className={cn('object-contain', className)}
    />
  );
}
