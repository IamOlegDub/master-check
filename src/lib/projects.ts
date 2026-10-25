export const projectStatuses = ['DRAFT', 'PENDING_APPROVAL', 'IN_PROGRESS', 'COMPLETED'] as const;

export type Project = {
    id: string;
    user_id: string;
    name: string;
    client: string;
    status: (typeof projectStatuses)[number];
    total: number;
    paid: number;
    created_at: string;
};
