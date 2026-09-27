begin;

create or replace function public.project_mutate(p_project_id uuid,p_action text,p_payload jsonb,p_request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.projects%rowtype; result jsonb; begin
 select * into p from public.projects where id=p_project_id and user_id=auth.uid() for update;
 if not found or not public.is_master() then raise exception 'Проєкт недоступний.' using errcode='42501'; end if;
 if p_action in ('status','complete_item') then raise exception 'Використовуйте погодження та звіти.'; end if;
 if p_action in ('add_item','edit_item','delete_item') then
   if p.status not in ('DRAFT','PENDING_APPROVAL') then raise exception 'Спочатку відкрийте нову редакцію кошторису.'; end if;
   if p_action<>'add_item' and exists(select 1 from public.work_reports where item_id=(p_payload->>'item_id')::uuid) then raise exception 'Пункт із історією звітів не можна змінити. Додайте нову роботу.'; end if;
 end if;
 result:=public.project_mutate_legacy(p_project_id,p_action,p_payload,p_request_id); return result;
end $$;

-- Keep the original item reference and its name as evidence after deletion.
-- The insert trigger enforces membership of live items; saved comments stay immutable.
alter table public.project_comments add column item_name text;
update public.project_comments c set item_name=i.name from public.project_items i where c.item_id=i.id;
alter table public.project_comments drop constraint project_comments_item_id_project_id_fkey;
create function public.snapshot_comment_item() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.item_id is not null then
  select name into new.item_name from public.project_items where id=new.item_id and project_id=new.project_id;
  if not found then raise exception 'Робота недоступна.'; end if;
 end if;
 return new;
end $$;
create trigger snapshot_comment_item before insert on public.project_comments for each row execute function public.snapshot_comment_item();
revoke all on function public.snapshot_comment_item() from public,anon,authenticated;

-- Approval must still refer to the latest nonempty estimate, under the same project lock.
alter function public.workflow_action(uuid,text,jsonb) rename to workflow_action_before_pending_edits;
revoke all on function public.workflow_action_before_pending_edits(uuid,text,jsonb) from public,anon,authenticated;
create function public.workflow_action(p_project_id uuid,p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not public.can_read_project(p_project_id) then raise exception 'Проєкт недоступний.' using errcode='42501'; end if;
 perform 1 from public.projects where id=p_project_id for update;
 if p_action='approve' and not exists(select 1 from public.project_items where project_id=p_project_id) then raise exception 'Неможливо погодити порожній кошторис. Дочекайтеся додавання робіт.'; end if;
 return public.workflow_action_before_pending_edits(p_project_id,p_action,p_payload);
end $$;
revoke all on function public.workflow_action(uuid,text,jsonb) from public,anon;
grant execute on function public.workflow_action(uuid,text,jsonb) to authenticated;

commit;
