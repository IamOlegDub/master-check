import Image from 'next/image';

export function BrandLogo({
    className = 'size-10',
    decorative = false,
}: {
    className?: string;
    decorative?: boolean;
}) {
    return (
        <Image
            src="/icons/logo.png"
            alt={decorative ? '' : 'Мій кошторис'}
            width={64}
            height={64}
            className={`shrink-0 object-contain ${className}`}
        />
    );
}
