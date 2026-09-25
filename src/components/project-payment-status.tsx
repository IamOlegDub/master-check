import { BadgeCheck, CircleDollarSign, Clock3, Wallet } from 'lucide-react';
import { formatPrice } from '@/lib/price-list';

export function ProjectPaymentStatus({ confirmed, paid }: { confirmed: number; paid: number }) {
    const due = Math.max(0, Math.round((confirmed - paid) * 100) / 100);
    const credit = Math.max(0, Math.round((paid - confirmed) * 100) / 100);
    const percent = confirmed > 0 ? Math.min(100, Math.round((paid / confirmed) * 100)) : 0;
    const Icon =
        due > 0 ? CircleDollarSign : credit > 0 ? Wallet : confirmed > 0 ? BadgeCheck : Clock3;
    const label =
        due > 0
            ? paid > 0
                ? 'Оплачено частково'
                : 'Очікує оплати'
            : credit > 0
              ? 'Є аванс'
              : confirmed > 0
                ? 'Підтверджені роботи оплачені'
                : 'Ще немає підтверджених робіт';
    return (
        <div
            className={`mt-4 rounded-xl p-3 ${due > 0 ? 'bg-amber-50 dark:bg-amber-950 text-amber-900 dark:text-amber-300' : confirmed > 0 ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300' : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300'}`}
        >
            <p className="flex items-center gap-2 text-sm font-medium">
                <Icon size={18} aria-hidden className="shrink-0" />
                {label}
            </p>
            <p className="mt-2 text-xs">
                Отримано: {formatPrice(paid)} · Підтверджено: {formatPrice(confirmed)}
            </p>
            {confirmed > 0 && (
                <progress
                    aria-label="Оплата підтверджених робіт"
                    className="mt-2 h-2 w-full accent-emerald-600"
                    max={confirmed}
                    value={Math.min(paid, confirmed)}
                />
            )}
            <p className="mt-1 text-xs">
                {due > 0
                    ? `До сплати: ${formatPrice(due)} · оплачено ${percent}%`
                    : credit > 0
                      ? `Аванс на наступні роботи: ${formatPrice(credit)}`
                      : confirmed > 0
                        ? 'Заборгованості за підтверджені роботи немає'
                        : 'Баланс з’явиться після підтвердження виконання'}
            </p>
        </div>
    );
}
