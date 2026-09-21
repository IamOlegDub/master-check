'use client';
import { Suspense, useEffect, useState } from 'react';
import { Dashboard } from '@/components/dashboard';
import { profileFromUser, type Profile } from '@/lib/profile';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
export default function Review() {
    const [profile, setProfile] = useState<Profile>();
    useEffect(() => { void createSupabaseBrowserClient()?.auth.getUser().then(({ data }) => { if (data.user) setProfile(profileFromUser(data.user)); }); }, []);
    return profile ? <Suspense><Dashboard settingsPage initialProfile={profile} userName="Review" userId="11111111-1111-4111-8111-111111111111" initialProjects={[]} loadError={null} /></Suspense> : <p>Loading</p>;
}
