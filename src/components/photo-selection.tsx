'use client';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
export function PhotoSelection({
    files,
    onRemove,
    disabled,
}: {
    files: File[];
    onRemove: (index: number) => void;
    disabled: boolean;
}) {
    const [urls, setUrls] = useState<string[]>([]);
    useEffect(() => {
        const next = files.map((file) => URL.createObjectURL(file));
        setUrls(next);
        return () => next.forEach(URL.revokeObjectURL);
    }, [files]);
    return (
        <div className="grid grid-cols-3 gap-3 sm:col-span-2 sm:grid-cols-5">
            {files.map((file, index) => (
                <div key={index} className="relative min-w-0">
                    <img
                        src={urls[index] || undefined}
                        alt={file.name}
                        className="aspect-square w-full rounded-xl object-cover"
                    />
                    <button
                        disabled={disabled}
                        type="button"
                        onClick={() => onRemove(index)}
                        aria-label={`Прибрати ${file.name}`}
                        className="absolute top-1 right-1 grid size-8 place-items-center rounded-full bg-card shadow"
                    >
                        <X size={16} />
                    </button>
                </div>
            ))}
        </div>
    );
}
