-- =============================================================
-- 03. 입고 전표: 입고예정(IP) → ASN·상차지시(AS) → 상차(LD) → 검수·입고(GR)
--     정합성 규칙 번호(R1~R13)는 docs/02-document-flow.md 참조
-- =============================================================

-- AI 판독 작업 (이미지 → 입고예정 초안)
create table public.ai_import_jobs (
  id            uuid        primary key default gen_random_uuid(),
  shipper_id    uuid        not null references public.shippers (id),
  image_path    text        not null,
  status        varchar(10) not null default 'PENDING'
                check (status in ('PENDING', 'DONE', 'FAILED', 'APPLIED')),
  raw_text      text,
  result_json   jsonb,
  error_message text,
  plan_id       uuid,
  created_at    timestamptz not null default now(),
  created_by    uuid,
  updated_at    timestamptz not null default now(),
  updated_by    uuid
);

-- ---------- 입고예정 IP ----------
create table public.inbound_plans (
  id            uuid        primary key default gen_random_uuid(),
  plan_no       varchar(20) not null unique default public.fn_next_doc_no('IP'),
  shipper_id    uuid        not null references public.shippers (id),
  center_id     uuid        not null references public.centers (id),
  plan_date     date        not null,
  source_type   varchar(10) not null default 'MANUAL' check (source_type in ('MANUAL', 'EXCEL', 'AI')),
  ai_job_id     uuid        references public.ai_import_jobs (id),
  status        varchar(10) not null default 'PENDING'
                check (status in ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  approved_by   uuid,
  approved_at   timestamptz,
  reject_reason text,
  remark        text,
  created_at    timestamptz not null default now(),
  created_by    uuid,
  updated_at    timestamptz not null default now(),
  updated_by    uuid
);
create index inbound_plans_date_idx on public.inbound_plans (plan_date, shipper_id);
alter table public.ai_import_jobs
  add constraint ai_import_jobs_plan_fk foreign key (plan_id) references public.inbound_plans (id);

create table public.inbound_plan_lines (
  id           uuid          primary key default gen_random_uuid(),
  plan_id      uuid          not null references public.inbound_plans (id) on delete cascade,
  line_no      integer       not null check (line_no > 0),
  item_id      uuid          not null references public.items (id),
  plan_qty     numeric(15,3) not null check (plan_qty > 0),
  approved_qty numeric(15,3) check (approved_qty >= 0),
  asn_qty      numeric(15,3) not null default 0 check (asn_qty >= 0),
  remark       text,
  created_at   timestamptz   not null default now(),
  created_by   uuid,
  updated_at   timestamptz   not null default now(),
  updated_by   uuid,
  constraint inbound_plan_lines_no_uk unique (plan_id, line_no),
  constraint inbound_plan_lines_asn_qty_ck check (asn_qty <= coalesce(approved_qty, 0))   -- R4
);
create index inbound_plan_lines_item_idx on public.inbound_plan_lines (item_id);

-- R1: 승인대기(PENDING)에서만 입고예정 수정·삭제 (업무 RPC 제외)
create or replace function public.fn_guard_plan_header()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('app.allow_status_change', true), '') = 'on' then
    return coalesce(new, old);
  end if;
  if old.status <> 'PENDING' then
    raise exception '입고예정 %은(는) % 상태라 수정·삭제할 수 없습니다.', old.plan_no, old.status
      using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and new.shipper_id is distinct from old.shipper_id then
    raise exception '입고예정의 화주사는 변경할 수 없습니다.' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger trg_guard_plan before update or delete on public.inbound_plans
  for each row execute function public.fn_guard_plan_header();
create trigger trg_guard_status before insert or update on public.inbound_plans
  for each row execute function public.fn_guard_status('PENDING');

-- R1·R2: 라인은 PENDING 전표에서만 변경, 품목은 같은 화주의 사용 중 품목
create or replace function public.fn_guard_plan_line()
returns trigger
language plpgsql
as $$
declare
  v_plan public.inbound_plans;
  v_rec  public.inbound_plan_lines := coalesce(new, old);
begin
  select * into v_plan from public.inbound_plans where id = v_rec.plan_id;
  if v_plan.id is null then
    return coalesce(new, old);   -- 헤더 cascade 삭제 중
  end if;

  -- asn_qty 집계 갱신은 상태와 무관하게 허용
  if tg_op = 'UPDATE'
     and (new.item_id, new.plan_qty, new.approved_qty, new.line_no, new.remark)
         is not distinct from (old.item_id, old.plan_qty, old.approved_qty, old.line_no, old.remark) then
    return new;
  end if;

  if v_plan.status <> 'PENDING'
     and coalesce(current_setting('app.allow_status_change', true), '') <> 'on' then
    raise exception '입고예정 %은(는) % 상태라 라인을 변경할 수 없습니다.', v_plan.plan_no, v_plan.status
      using errcode = 'P0001';
  end if;

  if tg_op <> 'DELETE' and not exists (
    select 1 from public.items i
    where i.id = new.item_id and i.shipper_id = v_plan.shipper_id and i.is_active
  ) then
    raise exception '입고예정 품목은 화주사의 사용 중인 품목이어야 합니다.' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger trg_guard_plan_line before insert or update or delete on public.inbound_plan_lines
  for each row execute function public.fn_guard_plan_line();

-- ---------- ASN · 상차지시서 AS ----------
create table public.asns (
  id         uuid        primary key default gen_random_uuid(),
  asn_no     varchar(20) not null unique default public.fn_next_doc_no('AS'),  -- 상차지시서 바코드
  shipper_id uuid        not null references public.shippers (id),
  center_id  uuid        not null references public.centers (id),
  asn_date   date        not null,
  vehicle_id uuid        not null references public.vehicles (id),
  vehicle_no varchar(20) not null default '',                                 -- 등록 시점 스냅샷
  status     varchar(12) not null default 'REGISTERED'
             check (status in ('REGISTERED', 'LOADED', 'RECEIVING', 'RECEIVED', 'CANCELLED')),
  remark     text,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create index asns_date_idx on public.asns (asn_date, shipper_id);
create index asns_vehicle_idx on public.asns (vehicle_id, asn_date);

-- R5: 차량은 ASN 화주의 차량, 차량번호 스냅샷
create or replace function public.fn_check_asn_header()
returns trigger
language plpgsql
as $$
declare
  v_vehicle public.vehicles;
begin
  if tg_op = 'UPDATE' and old.status <> 'REGISTERED'
     and coalesce(current_setting('app.allow_status_change', true), '') <> 'on' then
    raise exception 'ASN %은(는) % 상태라 수정할 수 없습니다.', old.asn_no, old.status using errcode = 'P0001';
  end if;
  select * into v_vehicle from public.vehicles where id = new.vehicle_id;
  if v_vehicle.shipper_id is distinct from new.shipper_id or not v_vehicle.is_active then
    raise exception 'ASN 차량은 해당 화주사의 사용 중인 차량이어야 합니다.' using errcode = 'P0001';
  end if;
  new.vehicle_no := v_vehicle.vehicle_no;
  return new;
end;
$$;
create trigger trg_check_asn before insert or update on public.asns
  for each row execute function public.fn_check_asn_header();
create trigger trg_guard_status before insert or update on public.asns
  for each row execute function public.fn_guard_status('REGISTERED');

create table public.asn_lines (
  id           uuid          primary key default gen_random_uuid(),
  asn_id       uuid          not null references public.asns (id) on delete cascade,
  line_no      integer       not null check (line_no > 0),
  plan_line_id uuid          not null references public.inbound_plan_lines (id) on delete restrict,  -- R13
  item_id      uuid          not null references public.items (id),
  order_qty    numeric(15,3) not null check (order_qty > 0),
  loaded_qty   numeric(15,3) not null default 0 check (loaded_qty >= 0),
  received_qty numeric(15,3) not null default 0 check (received_qty >= 0),
  return_qty   numeric(15,3) not null default 0 check (return_qty >= 0),
  diff_qty     numeric(15,3) generated always as (loaded_qty - received_qty - return_qty) stored,
  created_at   timestamptz   not null default now(),
  created_by   uuid,
  updated_at   timestamptz   not null default now(),
  updated_by   uuid,
  constraint asn_lines_no_uk unique (asn_id, line_no),
  constraint asn_lines_plan_line_uk unique (asn_id, plan_line_id)
);
create index asn_lines_plan_line_idx on public.asn_lines (plan_line_id);

-- R3·R4·R5: 승인된 입고예정 라인만, 같은 화주, 배정 합계 ≤ 승인수량
create or replace function public.fn_check_asn_line()
returns trigger
language plpgsql
as $$
declare
  v_asn       public.asns;
  v_plan      public.inbound_plans;
  v_line      public.inbound_plan_lines;
  v_allocated numeric;
begin
  -- 수량 집계(loaded/received/return) 갱신만 있는 경우는 통과
  if tg_op = 'UPDATE'
     and (new.plan_line_id, new.order_qty, new.line_no) is not distinct from (old.plan_line_id, old.order_qty, old.line_no) then
    return new;
  end if;

  select * into v_asn from public.asns where id = new.asn_id;
  if v_asn.status <> 'REGISTERED' then
    raise exception 'ASN %은(는) % 상태라 라인을 변경할 수 없습니다.', v_asn.asn_no, v_asn.status using errcode = 'P0001';
  end if;

  select * into v_line from public.inbound_plan_lines where id = new.plan_line_id;
  select * into v_plan from public.inbound_plans where id = v_line.plan_id;
  if v_plan.status <> 'APPROVED' then
    raise exception '승인된 입고예정만 ASN에 배정할 수 있습니다. (%: %)', v_plan.plan_no, v_plan.status using errcode = 'P0001';
  end if;
  if v_plan.shipper_id <> v_asn.shipper_id then
    raise exception 'ASN과 입고예정의 화주사가 다릅니다.' using errcode = 'P0001';
  end if;

  new.item_id := v_line.item_id;

  select coalesce(sum(al.order_qty), 0) into v_allocated
  from public.asn_lines al
  join public.asns a on a.id = al.asn_id
  where al.plan_line_id = new.plan_line_id
    and a.status <> 'CANCELLED'
    and al.id <> new.id;
  if v_allocated + new.order_qty > coalesce(v_line.approved_qty, 0) then
    raise exception 'ASN 배정 수량이 승인 수량을 초과합니다. (승인 %, 기배정 %, 요청 %)',
      v_line.approved_qty, v_allocated, new.order_qty using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger trg_check_asn_line before insert or update on public.asn_lines
  for each row execute function public.fn_check_asn_line();

create or replace function public.fn_guard_asn_line_delete()
returns trigger
language plpgsql
as $$
declare
  v_status text;
begin
  select status into v_status from public.asns where id = old.asn_id;
  if v_status is not null and v_status <> 'REGISTERED' then
    raise exception 'ASN이 % 상태라 라인을 삭제할 수 없습니다.', v_status using errcode = 'P0001';
  end if;
  return old;
end;
$$;
create trigger trg_guard_asn_line_delete before delete on public.asn_lines
  for each row execute function public.fn_guard_asn_line_delete();

-- 입고예정 라인의 asn_qty 재집계 (취소된 ASN 제외)
create or replace function public.fn_sync_plan_asn_qty(p_plan_line_id uuid)
returns void
language sql
as $$
  update public.inbound_plan_lines pl
  set asn_qty = (
    select coalesce(sum(al.order_qty), 0)
    from public.asn_lines al
    join public.asns a on a.id = al.asn_id
    where al.plan_line_id = pl.id and a.status <> 'CANCELLED'
  )
  where pl.id = p_plan_line_id;
$$;

create or replace function public.fn_after_asn_line()
returns trigger
language plpgsql
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.fn_sync_plan_asn_qty(old.plan_line_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.fn_sync_plan_asn_qty(new.plan_line_id);
  end if;
  return null;
end;
$$;
create trigger trg_after_asn_line after insert or update of plan_line_id, order_qty or delete on public.asn_lines
  for each row execute function public.fn_after_asn_line();

create or replace function public.fn_after_asn_status()
returns trigger
language plpgsql
as $$
begin
  perform public.fn_sync_plan_asn_qty(al.plan_line_id)
  from public.asn_lines al where al.asn_id = new.id;
  return null;
end;
$$;
create trigger trg_after_asn_status after update of status on public.asns
  for each row when (old.status is distinct from new.status)
  execute function public.fn_after_asn_status();

-- ---------- 상차 LD ----------
create table public.loadings (
  id           uuid        primary key default gen_random_uuid(),
  loading_no   varchar(20) not null unique default public.fn_next_doc_no('LD'),
  asn_id       uuid        not null unique references public.asns (id) on delete restrict,
  status       varchar(10) not null default 'LOADING' check (status in ('LOADING', 'COMPLETED')),
  worker_id    uuid,
  started_at   timestamptz not null default now(),
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  created_by   uuid,
  updated_at   timestamptz not null default now(),
  updated_by   uuid
);
create trigger trg_guard_status before insert or update on public.loadings
  for each row execute function public.fn_guard_status('LOADING');

create table public.loading_lines (
  id              uuid          primary key default gen_random_uuid(),
  loading_id      uuid          not null references public.loadings (id) on delete cascade,
  asn_line_id     uuid          not null references public.asn_lines (id) on delete restrict,
  item_id         uuid          not null references public.items (id),
  scanned_barcode varchar(50),
  loaded_qty      numeric(15,3) not null default 0 check (loaded_qty >= 0),
  created_at      timestamptz   not null default now(),
  created_by      uuid,
  updated_at      timestamptz   not null default now(),
  updated_by      uuid,
  constraint loading_lines_asn_line_uk unique (loading_id, asn_line_id)
);

create or replace function public.fn_check_loading_line()
returns trigger
language plpgsql
as $$
declare
  v_status text;
begin
  select l.status into v_status from public.loadings l where l.id = (coalesce(new, old)).loading_id;
  if v_status = 'COMPLETED'
     and coalesce(current_setting('app.allow_status_change', true), '') <> 'on' then
    raise exception '상차완료된 전표는 변경할 수 없습니다.' using errcode = 'P0001';
  end if;
  if tg_op <> 'DELETE' then
    select al.item_id into new.item_id from public.asn_lines al where al.id = new.asn_line_id;
    if not exists (
      select 1 from public.asn_lines al join public.loadings l on l.asn_id = al.asn_id
      where al.id = new.asn_line_id and l.id = new.loading_id
    ) then
      raise exception '상차 라인은 해당 ASN의 라인이어야 합니다.' using errcode = 'P0001';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;
create trigger trg_check_loading_line before insert or update or delete on public.loading_lines
  for each row execute function public.fn_check_loading_line();

-- asn_lines.loaded_qty 동기화
create or replace function public.fn_after_loading_line()
returns trigger
language plpgsql
as $$
declare
  v_asn_line_id uuid := (coalesce(new, old)).asn_line_id;
begin
  update public.asn_lines al
  set loaded_qty = (select coalesce(sum(ll.loaded_qty), 0) from public.loading_lines ll where ll.asn_line_id = al.id)
  where al.id = v_asn_line_id;
  return null;
end;
$$;
create trigger trg_after_loading_line after insert or update or delete on public.loading_lines
  for each row execute function public.fn_after_loading_line();

-- ---------- 검수·입고 GR ----------
create table public.receipts (
  id           uuid        primary key default gen_random_uuid(),
  receipt_no   varchar(20) not null unique default public.fn_next_doc_no('GR'),
  asn_id       uuid        not null unique references public.asns (id) on delete restrict,
  shipper_id   uuid        not null references public.shippers (id),
  center_id    uuid        not null references public.centers (id),
  receipt_date date        not null default (now() at time zone 'Asia/Seoul')::date,
  status       varchar(12) not null default 'INSPECTING' check (status in ('INSPECTING', 'COMPLETED')),
  worker_id    uuid,
  started_at   timestamptz not null default now(),
  completed_at timestamptz,
  remark       text,
  created_at   timestamptz not null default now(),
  created_by   uuid,
  updated_at   timestamptz not null default now(),
  updated_by   uuid
);
create index receipts_date_idx on public.receipts (receipt_date, shipper_id);
create trigger trg_guard_status before insert or update on public.receipts
  for each row execute function public.fn_guard_status('INSPECTING');

create table public.receipt_lines (
  id                 uuid          primary key default gen_random_uuid(),
  receipt_id         uuid          not null references public.receipts (id) on delete cascade,
  asn_line_id        uuid          not null references public.asn_lines (id) on delete restrict,
  item_id            uuid          not null references public.items (id),
  scanned_barcode    varchar(50),
  result_code        varchar(30)   not null default 'NORMAL',
  return_reason_code varchar(30),
  received_qty       numeric(15,3) not null default 0 check (received_qty >= 0),
  return_qty         numeric(15,3) not null default 0 check (return_qty >= 0),
  lot_no             varchar(50),
  expiry_date        date,
  remark             text,
  created_at         timestamptz   not null default now(),
  created_by         uuid,
  updated_at         timestamptz   not null default now(),
  updated_by         uuid
);
create index receipt_lines_asn_line_idx on public.receipt_lines (asn_line_id);

create trigger trg_codes before insert or update on public.receipt_lines
  for each row execute function public.fn_validate_codes(
    'result_code', 'INSPECT_RESULT', 'return_reason_code', 'RETURN_REASON');

-- R9: 로트·유통기한 관리 품목 필수 입력, 완료 전표 변경 불가
create or replace function public.fn_check_receipt_line()
returns trigger
language plpgsql
as $$
declare
  v_status text;
  v_item   public.items;
begin
  select r.status into v_status from public.receipts r where r.id = (coalesce(new, old)).receipt_id;
  if v_status = 'COMPLETED'
     and coalesce(current_setting('app.allow_status_change', true), '') <> 'on' then
    raise exception '입고완료된 전표는 변경할 수 없습니다.' using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;

  if not exists (
    select 1 from public.asn_lines al join public.receipts r on r.asn_id = al.asn_id
    where al.id = new.asn_line_id and r.id = new.receipt_id
  ) then
    raise exception '검수 라인은 해당 ASN의 라인이어야 합니다.' using errcode = 'P0001';
  end if;

  select i.* into v_item from public.items i where i.id = new.item_id;
  if new.received_qty > 0 then
    if v_item.lot_yn and coalesce(new.lot_no, '') = '' then
      raise exception '품목 %은(는) 로트 관리 품목입니다. 로트번호를 입력하세요.', v_item.item_name using errcode = 'P0001';
    end if;
    if v_item.expiry_yn and new.expiry_date is null then
      raise exception '품목 %은(는) 유통기한 관리 품목입니다. 유통기한을 입력하세요.', v_item.item_name using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;
create trigger trg_check_receipt_line before insert or update or delete on public.receipt_lines
  for each row execute function public.fn_check_receipt_line();

-- asn_lines.received_qty / return_qty 동기화
create or replace function public.fn_after_receipt_line()
returns trigger
language plpgsql
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    update public.asn_lines al
    set received_qty = s.received, return_qty = s.returned
    from (select coalesce(sum(received_qty), 0) received, coalesce(sum(return_qty), 0) returned
          from public.receipt_lines where asn_line_id = old.asn_line_id) s
    where al.id = old.asn_line_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    update public.asn_lines al
    set received_qty = s.received, return_qty = s.returned
    from (select coalesce(sum(received_qty), 0) received, coalesce(sum(return_qty), 0) returned
          from public.receipt_lines where asn_line_id = new.asn_line_id) s
    where al.id = new.asn_line_id;
  end if;
  return null;
end;
$$;
create trigger trg_after_receipt_line after insert or update or delete on public.receipt_lines
  for each row execute function public.fn_after_receipt_line();

create table public.receipt_images (
  id              uuid        primary key default gen_random_uuid(),
  receipt_line_id uuid        not null references public.receipt_lines (id) on delete cascade,
  storage_path    text        not null,
  file_name       varchar(200),
  created_at      timestamptz not null default now(),
  created_by      uuid,
  updated_at      timestamptz not null default now(),
  updated_by      uuid
);
create index receipt_images_line_idx on public.receipt_images (receipt_line_id);

-- ---------- 전표 추적 뷰 (IP → AS → LD → GR) ----------
create view public.v_doc_trace
with (security_invoker = true)
as
select
  p.id            as plan_id,
  p.plan_no,
  p.plan_date,
  p.status        as plan_status,
  pl.line_no      as plan_line_no,
  a.id            as asn_id,
  a.asn_no,
  a.asn_date,
  a.status        as asn_status,
  a.vehicle_no,
  al.line_no      as asn_line_no,
  ld.loading_no,
  ld.status       as loading_status,
  r.receipt_no,
  r.status        as receipt_status,
  s.shipper_code,
  s.shipper_name,
  i.internal_code,
  i.shipper_item_code,
  i.item_name,
  pl.plan_qty,
  pl.approved_qty,
  al.order_qty,
  al.loaded_qty,
  al.received_qty,
  al.return_qty,
  al.diff_qty
from public.asn_lines al
join public.asns a                on a.id = al.asn_id
join public.inbound_plan_lines pl on pl.id = al.plan_line_id
join public.inbound_plans p       on p.id = pl.plan_id
join public.shippers s            on s.id = a.shipper_id
join public.items i               on i.id = al.item_id
left join public.loadings ld      on ld.asn_id = a.id
left join public.receipts r       on r.asn_id = a.id;

-- 감사 컬럼 + 이력
select public.fn_enable_audit(t), public.fn_enable_history(t)
from unnest(array[
  'ai_import_jobs', 'inbound_plans', 'inbound_plan_lines', 'asns', 'asn_lines',
  'loadings', 'loading_lines', 'receipts', 'receipt_lines', 'receipt_images'
]) as t;
