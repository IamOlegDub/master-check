'use client';
import { ErrorScreen } from '@/components/error-screen';
export default function WorkspaceError({ retry }: { retry: () => void }) {
    return <ErrorScreen retry={retry} compact />;
}
