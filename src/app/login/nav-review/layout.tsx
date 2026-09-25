import { WorkspaceShell } from '@/components/workspace-shell';
export default function Layout({ children }: { children: React.ReactNode }) { return <WorkspaceShell role="MASTER" name="Test User">{children}</WorkspaceShell>; }
