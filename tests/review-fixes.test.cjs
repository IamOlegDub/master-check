const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');

test('privileges, account deletion, storage checks, invites and links after the review migration', async () => {
    const db = new PGlite();
    const master = crypto.randomUUID(),
        client = crypto.randomUUID(),
        outsider = crypto.randomUUID(),
        project = crypto.randomUUID(),
        category = crypto.randomUUID(),
        service = crypto.randomUUID();
    try {
        // Supabase grants every new table and function to the API roles by default.
        await db.exec(
            `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to authenticated,anon;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema storage to anon,authenticated;grant select,insert,delete on storage.objects to anon,authenticated;create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
            alter default privileges in schema public grant all on tables to anon,authenticated;
            alter default privileges in schema public grant all on functions to anon,authenticated;`,
        );
        for (const name of fs.readdirSync('supabase/migrations').sort())
            await db.exec(fs.readFileSync('supabase/migrations/' + name, 'utf8'));
        const anonFunctions = (
            await db.query(
                "select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and has_function_privilege('anon',p.oid,'execute') order by 1",
            )
        ).rows.map((r) => r.proname);
        assert.deepEqual(anonFunctions, [
            'can_read_overview_video',
            'can_read_portfolio_path',
            'public_portfolio',
        ]);
        const grants = async (role, table) =>
            (
                await db.query(
                    "select string_agg(privilege_type,',' order by privilege_type) p from information_schema.role_table_grants where grantee=$1 and table_schema='public' and table_name=$2",
                    [role, table],
                )
            ).rows[0].p;
        for (const table of ['accounts', 'clients', 'project_members', 'project_invites', 'work_reports'])
            assert.equal(await grants('anon', table), null);
        assert.equal(await grants('authenticated', 'clients'), 'DELETE,INSERT,SELECT');
        assert.equal(await grants('authenticated', 'project_members'), null);

        await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,null,null),($2,$4,now()),($3,null,null)', [
            master,
            client,
            outsider,
            'client@example.com',
        ]);
        async function as(uid) {
            await db.exec('reset role');
            await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid ?? '']);
            if (uid) await db.exec('set role authenticated');
        }
        const rpc = async (name, ...values) =>
            (
                await db.query(
                    `select public.${name}(${values.map((_, i) => '$' + (i + 1)).join(',')}) as value`,
                    values,
                )
            ).rows[0].value;
        await as(master);
        await rpc('register_master', 'review-master');
        await as(outsider);
        await rpc('choose_role', 'CLIENT');
        await as(null);
        await db.query("insert into public.service_categories(id,user_id,name) values($1,$2,'Tile')", [category, master]);
        await db.query("insert into public.services(id,user_id,category_id,name,unit,price) values($1,$2,$3,'Tile','m2',400)", [service, master, category]);
        await db.query("insert into public.projects(id,user_id,name,status) values($1,$2,'Review','DRAFT')", [project, master]);

        // A renamed contact updates the projects linked to it.
        await as(master);
        const contact = (
            await db.query("insert into public.clients(user_id,name) values($1,'Олег') returning id", [master])
        ).rows[0].id;
        let d = await rpc('workflow_detail', project);
        const act = async (name, payload = {}) =>
            (d = await rpc('workflow_action', project, name, JSON.stringify({ ...payload, version: d.project.version })));
        await act('link_client', { client_id: contact });
        await db.query("update public.clients set name='Олег Петренко' where id=$1", [contact]);
        assert.equal((await rpc('workflow_detail', project)).project.client, 'Олег Петренко');

        const item = (
            await rpc('project_mutate', project, 'add_item', JSON.stringify({ service_id: service, quantity: 10, version: d.project.version }), crypto.randomUUID())
        ).items[0].id;
        d = await rpc('workflow_detail', project);
        // Invites work the same whether or not the email is registered.
        assert.match(await rpc('make_invite', project, 'nobody@example.com'), /^[0-9a-f-]{36}$/);
        const invite = await rpc('make_invite', project, 'client@example.com');
        await as(outsider);
        await assert.rejects(() => rpc('make_invite', project, 'client@example.com'));
        assert.equal((await db.query('select id from public.projects')).rows.length, 0);
        await as(client);
        assert.equal(await rpc('accept_invite', invite), project);
        assert.deepEqual((await db.query('select id from public.projects')).rows, [{ id: project }]);
        assert.equal((await rpc('workspace_projects')).length, 1);

        await as(master);
        d = await rpc('workflow_detail', project);
        await act('request_approval');
        await as(client);
        await act('approve');
        assert.equal(d.project.approved_estimate.length, 1);
        await as(master);
        const report = crypto.randomUUID();
        const photo = `${project}/${master}/${report}/photo.webp`;
        await as(null);
        await db.query("insert into storage.objects(bucket_id,name) values('reports',$1)", [photo]);
        await as(master);
        await act('submit_report', { id: report, item_id: item, quantity: 5, occurred_at: new Date().toISOString(), photos: [photo] });

        // Storage reads go through the project in the path.
        const visible = async (bucket) =>
            (await db.query('select name from storage.objects where bucket_id=$1 order by name', [bucket])).rows.map((r) => r.name);
        await as(client);
        assert.deepEqual(await visible('reports'), [photo]);
        await as(outsider);
        assert.deepEqual(await visible('reports'), []);

        // Members keep at most 30 unsent files per project and may delete them.
        await as(client);
        const comment = crypto.randomUUID();
        const files = Array.from({ length: 30 }, (_, i) => `${project}/${client}/${comment}/file-${String(i).padStart(2, '0')}`);
        for (const name of files) await db.query("insert into storage.objects(bucket_id,name) values('project-attachments',$1)", [name]);
        const extra = `${project}/${client}/${comment}/extra`;
        await assert.rejects(() => db.query("insert into storage.objects(bucket_id,name) values('project-attachments',$1)", [extra]));
        await rpc('collaboration_action', project, 'comment', JSON.stringify({ id: comment, body: 'Фото', attachments: [{ path: files[0], name: 'a.jpg' }] }));
        await db.query("insert into storage.objects(bucket_id,name) values('project-attachments',$1)", [extra]);
        await db.query("delete from storage.objects where bucket_id='project-attachments' and name=any($1)", [[files[0], files[1]]]);
        const left = await visible('project-attachments');
        assert.ok(left.includes(files[0]));
        assert.ok(!left.includes(files[1]));
        await as(outsider);
        await assert.rejects(() => db.query("insert into storage.objects(bucket_id,name) values('project-attachments',$1)", [`${project}/${outsider}/${comment}/x`]));
        assert.deepEqual(await visible('project-attachments'), []);

        // A new revision drops the old approval snapshot.
        await as(client);
        d = await rpc('workflow_detail', project);
        await act('confirm_report', { id: report });
        await as(master);
        await act('revise');
        assert.equal(d.project.approved_estimate, null);
        assert.equal(d.project.status, 'DRAFT');

        // Replaced public links stop working.
        const album = (await rpc('portfolio_action', 'create', JSON.stringify({ title: 'Ванна' }))).id;
        await rpc('portfolio_action', 'publish', JSON.stringify({ id: album, published: true }));
        const firstAll = (await rpc('portfolio_action', 'share_all', JSON.stringify({ published: true }))).token;
        const firstAlbum = (await db.query('select share_token from public.portfolio_albums where id=$1', [album])).rows[0].share_token;
        const nextAll = (await rpc('portfolio_action', 'rotate_all', '{}')).token;
        await rpc('portfolio_action', 'rotate_album', JSON.stringify({ id: album }));
        const nextAlbum = (await db.query('select share_token from public.portfolio_albums where id=$1', [album])).rows[0].share_token;
        assert.notEqual(nextAll, firstAll);
        assert.notEqual(nextAlbum, firstAlbum);
        assert.equal((await rpc('public_portfolio', firstAll)).length, 0);
        assert.equal((await rpc('public_portfolio', firstAlbum)).length, 0);
        assert.equal((await rpc('public_portfolio', nextAll)).length, 1);
        assert.equal((await rpc('public_portfolio', nextAlbum)).length, 1);
        await as(client);
        await assert.rejects(() => rpc('portfolio_action', 'rotate_album', JSON.stringify({ id: album })));

        // Deleting the client keeps the master's project; deleting the master removes it.
        await as(null);
        await db.query('delete from auth.users where id=$1', [client]);
        const kept = await db.query('select approved_by from public.projects where id=$1', [project]);
        assert.equal(kept.rows.length, 1);
        assert.equal((await db.query('select author_id from public.project_comments where id=$1', [comment])).rows[0].author_id, null);
        await db.query('delete from auth.users where id=$1', [master]);
        for (const table of ['projects', 'clients', 'work_reports', 'project_comments', 'portfolio_albums', 'accounts'])
            assert.equal(
                (await db.query(`select count(*)::int n from public.${table} where ${table === 'accounts' ? 'user_id' : 'true'} ${table === 'accounts' ? '=$1' : ''}`, table === 'accounts' ? [master] : [])).rows[0].n,
                0,
            );
    } finally {
        await db.close();
    }
});
