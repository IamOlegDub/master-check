import Link from 'next/link';
import { MapPinOff, ArrowLeft, Home } from 'lucide-react';
export default function NotFound() {
    return (
        <main className="grid min-h-dvh place-items-center bg-linear-to-br from-[#f6f4ff] via-white to-[#edf7f6] p-6 text-ink">
            <div className="w-full max-w-lg rounded-3xl border border-white bg-white/80 p-8 text-center shadow-[0_24px_80px_#584a9912] sm:p-12">
                <div className="mx-auto mb-6 grid size-20 place-items-center rounded-3xl bg-[#eeebff] text-brand">
                    <MapPinOff size={36} />
                </div>
                <p className="text-sm font-semibold tracking-[.25em] text-brand">
                    404 · СТОРІНКУ НЕ ЗНАЙДЕНО
                </p>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight">
                    Здається, тут поки порожньо
                </h1>
                <p className="mt-4 leading-7 text-subtle">
                    Посилання може бути помилковим, матеріали приховано або у вас немає доступу до
                    цього проєкту.
                </p>
                <div className="mt-8 grid gap-3">
                    <Link
                        href="/"
                        className="flex items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-white"
                    >
                        <Home size={18} />
                        До робочого простору
                    </Link>
                    <Link
                        href="/projects"
                        className="flex items-center justify-center gap-2 rounded-xl border border-line px-5 py-3"
                    >
                        <ArrowLeft size={18} />
                        Мої проєкти
                    </Link>
                </div>
            </div>
        </main>
    );
}
