-- Profile fields live in auth.users.raw_user_meta_data.mastercheck_profile.
-- Supabase Auth only permits users to update their own metadata.
-- Avatars are public images; only the owner can upload/delete their files.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do update set public = true, file_size_limit = 2097152,
    allowed_mime_types = array['image/webp', 'image/png', 'image/jpeg'];

create policy "Avatar owner can upload" on storage.objects for insert to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Avatar owner can read objects" on storage.objects for select to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Avatar owner can delete" on storage.objects for delete to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
