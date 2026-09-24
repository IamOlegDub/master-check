'use client';
import { ErrorScreen } from '@/components/error-screen';
export default function WorkspaceError({ reset }: { reset: () => void }) {
    return <ErrorScreen reset={reset} compact />;
}
