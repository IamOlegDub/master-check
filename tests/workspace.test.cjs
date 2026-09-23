const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const crypto = require('node:crypto');
test('collaboration migrations enforce roles, invitations, approvals, partial reports, finance and public sharing', async () => {
    const db = new PGlite();
    const master = crypto.randomUUID(),
        client = crypto.randomUUID(),
        other = crypto.randomUUID(),
        project = crypto.randomUUID(),
        category = crypto.randomUUID(),
        service = crypto.randomUUID();
    try {
        await db.exec(
            `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to authenticated,anon;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema storage to anon,authenticated;grant select,insert,delete on storage.objects to anon,authenticated;create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;`,
        );
        await db.query('insert into auth.users values($1)', [master]);
        for (const name of fs.readdirSync('supabase/migrations').sort())
            await db.exec(fs.readFileSync('supabase/migrations/' + name, 'utf8'));
        await db.query('insert into auth.users values($1),($2)', [client, other]);
        async function as(uid, role = 'authenticated') {
            await db.exec('reset role');
            await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid ?? '']);
            await db.exec('set role ' + role);
        }
        const rpc = async (name, args) => {
            const values = Object.values(args);
            return (
                await db.query(
                    `select public.${name}(${values.map((_, i) => '$' + (i + 1)).join(',')}) as value`,
                    values,
                )
            ).rows[0].value;
        };
        await as(master);
        assert.equal(await rpc('choose_role', { role: 'CLIENT' }), 'MASTER');
        await db.query('insert into public.service_categories(id,user_id,name) values($1,$2,$3)', [
            category,
            master,
            'Tile',
        ]);
        await db.query(
            "insert into public.services(id,user_id,category_id,name,unit,price) values($1,$2,$3,'Tile','m2',400)",
            [service, master, category],
        );
        await db.query(
            "insert into public.projects(id,user_id,name,status) values($1,$2,'Test','DRAFT')",
            [project, master],
        );
        let detail = await rpc('project_mutate', {
            project,
            action: 'add_item',
            payload: JSON.stringify({ service_id: service, quantity: 400, version: 0 }),
            request: crypto.randomUUID(),
        });
        const item = detail.items[0].id;
        const revoked = await rpc('make_invite', { project });
        const invite = await rpc('make_invite', { project });
        await as(client);
        await assert.rejects(() => rpc('accept_invite', { invite: revoked }));
        assert.equal(await rpc('accept_invite', { invite }), project);
        assert.equal(await rpc('accept_invite', { invite }), project);
        await assert.rejects(() =>
            db.query(
                "insert into public.projects(user_id,name,status) values($1,'Forbidden','DRAFT')",
                [client],
            ),
        );
        await assert.rejects(() =>
            db.query("insert into public.service_categories(user_id,name) values($1,'Forbidden')", [
                client,
            ]),
        );
        await assert.rejects(() =>
            rpc('project_mutate', {
                project,
                action: 'payment',
                payload: '{"amount":100,"version":1}',
                request: crypto.randomUUID(),
            }),
        );
        await as(other);
        await rpc('choose_role', { role: 'CLIENT' });
        await assert.rejects(() => rpc('accept_invite', { invite }));
        assert.equal((await db.query('select * from public.projects')).rows.length, 0);
        await assert.rejects(() => rpc('workflow_detail', { project }));
        await as(master);
        let d = await rpc('workflow_detail', { project });
        async function action(name, payload = {}) {
            d = await rpc('workflow_action', {
                project,
                action: name,
                payload: JSON.stringify({ ...payload, version: d.project.version }),
            });
            return d;
        }
        await action('request_approval');
        await assert.rejects(() => rpc('workflow_action', {project, action:'revise', payload:JSON.stringify({version:d.project.version-1})}));
        await assert.rejects(() => rpc('project_mutate_legacy', {project,action:'status',payload:'{}',request:crypto.randomUUID()}));
        await assert.rejects(() =>
            rpc('project_mutate', {
                project,
                action: 'edit_item',
                payload: JSON.stringify({
                    item_id: item,
                    quantity: 1,
                    unit_price: 400,
                    version: d.project.version,
                }),
                request: crypto.randomUUID(),
            }),
        );
        await as(client);
        await action('approve');
        assert.equal(d.project.status, 'IN_PROGRESS');
        assert.equal(d.project.approved_estimate[0].unit_price, 400);
        await as(master);
        await assert.rejects(() => action('finish'));
        const report = crypto.randomUUID();
        const reportPhoto = `${project}/${master}/${report}/photo.webp`;
        await db.query("insert into storage.objects(bucket_id,name) values('reports',$1)",[reportPhoto]);
        await action('submit_report', {
            id: report,
            item_id: item,
            quantity: 50,
            occurred_at: '2026-01-01T12:00:00Z',
            note: 'First 50',
            photos: [reportPhoto],
        });
        assert.equal((await db.query("delete from storage.objects where name=$1 returning *",[reportPhoto])).rows.length,0);
        await as(other);
        assert.equal((await db.query("select * from storage.objects where bucket_id='reports'")).rows.length,0);
        await assert.rejects(()=>db.query("insert into storage.objects(bucket_id,name) values('reports',$1)",[`${project}/${other}/bad/photo.webp`]));
        await as(master);
        await assert.rejects(() =>
            action('submit_report', {
                id: crypto.randomUUID(),
                item_id: item,
                quantity: 351,
                occurred_at: '2026-01-01T12:00:00Z',
            }),
        );
        await assert.rejects(() => action('confirm_report', { id: report }));
        await as(client);
        assert.equal((await db.query("select * from storage.objects where bucket_id='reports'")).rows.length,1);
        await assert.rejects(()=>db.query("update public.work_reports set status='CONFIRMED' where id=$1",[report]));
        await assert.rejects(()=>action('submit_report',{id:crypto.randomUUID(),item_id:item,quantity:1,occurred_at:'2026-01-01T12:00:00Z'}));
        await action('confirm_report', { id: report });
        assert.equal(Number(d.confirmed_total), 20000);
        await assert.rejects(() => action('confirm_report', { id: report }));
        await as(master);
        detail = await rpc('project_mutate', {
            project,
            action: 'payment',
            payload: JSON.stringify({ amount: 15000, version: d.project.version }),
            request: crypto.randomUUID(),
        });
        d = await rpc('workflow_detail', { project });
        assert.equal(Number(d.confirmed_total) - Number(d.project.paid), 5000);
        assert.equal(Number(d.project.total) - Number(d.project.paid), 145000);
        let list = await rpc('workspace_projects', {});
        assert.equal(Number(list[0].progress), 13);
        assert.equal(Number(list[0].advance_total), 15000);
        const returned = crypto.randomUUID();
        await action('submit_report', {
            id: returned,
            item_id: item,
            quantity: 350,
            occurred_at: '2026-01-01T12:00:00Z',
        });
        await as(client);
        await assert.rejects(() => action('return_report', { id: returned }));
        await action('return_report', { id: returned, note: 'Need photos' });
        await as(master);
        await action('revise');
        await assert.rejects(() =>
            rpc('project_mutate', {
                project,
                action: 'edit_item',
                payload: JSON.stringify({
                    item_id: item,
                    quantity: 400,
                    unit_price: 500,
                    version: d.project.version,
                }),
                request: crypto.randomUUID(),
            }),
        );
        await action('request_approval');
        await as(client);
        await action('approve');
        await as(master);
        const last = crypto.randomUUID();
        await action('submit_report', {
            id: last,
            item_id: item,
            quantity: 350,
            occurred_at: '2026-01-01T12:00:00Z',
        });
        await as(client);
        await action('confirm_report', { id: last });
        await as(master);
        await action('finish');
        assert.equal(d.project.status, 'COMPLETED');
        assert.equal(Number(d.confirmed_total), 160000);
        const album = (
            await rpc('portfolio_action', {
                action: 'create',
                payload: JSON.stringify({ title: 'Portfolio', category_ids: [category] }),
            })
        ).id;
        const path = `${master}/${album}/photo.webp`;
        await db.query("insert into storage.objects(bucket_id,name) values('portfolio',$1)", [
            path,
        ]);
        await rpc('portfolio_action', {
            action: 'photo',
            payload: JSON.stringify({ id: album, path }),
        });
        const token = (
            await db.query('select share_token from public.portfolio_albums where id=$1', [album])
        ).rows[0].share_token;
        await as(null, 'anon');
        assert.deepEqual(await rpc('public_portfolio', { token }), []);
        assert.equal((await db.query('select * from storage.objects')).rows.length, 0);
        await assert.rejects(() => rpc('workflow_detail', { project }));
        await as(master);
        await rpc('portfolio_action', {
            action: 'publish',
            payload: JSON.stringify({ id: album, published: true }),
        });
        await as(null, 'anon');
        assert.equal((await rpc('public_portfolio', { token })).length, 1);
        assert.equal((await db.query('select * from storage.objects')).rows.length, 1);
        await as(master);
        await rpc('portfolio_action', {
            action: 'publish',
            payload: JSON.stringify({ id: album, published: false }),
        });
        await as(null, 'anon');
        assert.deepEqual(await rpc('public_portfolio', { token }), []);
        assert.equal((await db.query('select * from storage.objects')).rows.length, 0);
    } finally {
        await db.close();
    }
});
