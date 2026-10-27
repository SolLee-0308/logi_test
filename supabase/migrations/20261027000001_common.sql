-- =============================================================
-- 01. 공통 함수: 감사 컬럼, 테이블별 이력, 전표 채번, 상태 가드, 공통코드 검증
-- =============================================================

-- 감사 컬럼(created_*/updated_*) 자동 기록
create or replace function public.fn_set_audit()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.created_by := coalesce(new.created_by, auth.uid());
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create or replace function public.fn_enable_audit(p_table text)
returns void
language plpgsql
as $$
begin
  execute format('drop trigger if exists trg_audit on public.%I', p_table);
  execute format(
    'create trigger trg_audit before insert or update on public.%I
       for each row execute function public.fn_set_audit()', p_table);
end;
$$;

-- 테이블별 이력: <table>_hist 에 행 전체 + hist_op/hist_by/hist_at/hist_id 저장
create or replace function public.fn_write_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    execute format('insert into public.%I select ($1).*, $2, $3, now()', tg_table_name || '_hist')
      using old, 'D', auth.uid();
    return old;
  end if;
  execute format('insert into public.%I select ($1).*, $2, $3, now()', tg_table_name || '_hist')
    using new, left(tg_op, 1), auth.uid();
  return new;
end;
$$;

-- 원본 컬럼이 앞에 오고 hist 컬럼이 뒤에 붙는 구조여야 fn_write_history 의 ($1).* 가 맞는다.
create or replace function public.fn_enable_history(p_table text)
returns void
language plpgsql
as $$
declare
  v_hist text := p_table || '_hist';
begin
  execute format('create table if not exists public.%I (like public.%I)', v_hist, p_table);
  execute format(
    'alter table public.%I
       add column if not exists hist_op char(1) not null,
       add column if not exists hist_by uuid,
       add column if not exists hist_at timestamptz not null default now(),
       add column if not exists hist_id bigint generated always as identity primary key', v_hist);
  execute format('create index if not exists %I on public.%I (hist_at)', v_hist || '_at_idx', v_hist);
  execute format('alter table public.%I enable row level security', v_hist);
  execute format('drop trigger if exists trg_hist on public.%I', p_table);
  execute format(
    'create trigger trg_hist after insert or update or delete on public.%I
       for each row execute function public.fn_write_history()', p_table);
end;
$$;

-- 전표 채번: {prefix}-YYYYMMDD-#### (한국 시간 기준 일자)
create table public.doc_sequences (
  prefix   varchar(4) not null,
  seq_date date       not null,
  last_no  integer    not null default 0,
  primary key (prefix, seq_date)
);
alter table public.doc_sequences enable row level security;

create or replace function public.fn_next_doc_no(
  p_prefix text,
  p_date   date default (now() at time zone 'Asia/Seoul')::date
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_no integer;
begin
  insert into doc_sequences (prefix, seq_date, last_no)
  values (p_prefix, p_date, 1)
  on conflict (prefix, seq_date) do update set last_no = doc_sequences.last_no + 1
  returning last_no into v_no;
  return p_prefix || '-' || to_char(p_date, 'YYYYMMDD') || '-' || lpad(v_no::text, 4, '0');
end;
$$;

-- 상태 가드: status 는 업무 RPC 안에서 app.allow_status_change = 'on' 일 때만 변경 가능.
-- TG_ARGV[0] = 등록 시 허용되는 초기 상태
create or replace function public.fn_guard_status()
returns trigger
language plpgsql
as $$
declare
  v_allowed boolean := coalesce(current_setting('app.allow_status_change', true), '') = 'on';
begin
  if v_allowed then
    return new;
  end if;
  if tg_op = 'INSERT' and new.status is distinct from tg_argv[0] then
    raise exception '[%] 등록 시 상태는 % 이어야 합니다. (입력값: %)', tg_table_name, tg_argv[0], new.status
      using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    raise exception '[%] 상태는 업무 처리 함수를 통해서만 변경할 수 있습니다. (% → %)',
      tg_table_name, old.status, new.status
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- 업무 RPC 에서 상태 변경을 허용할 때 호출 (트랜잭션 범위)
create or replace function public.fn_allow_status_change()
returns void
language sql
as $$
  select set_config('app.allow_status_change', 'on', true);
$$;

-- 공통코드 값 검증: TG_ARGV = (컬럼명, 유형코드) 쌍의 나열
create or replace function public.fn_validate_codes()
returns trigger
language plpgsql
as $$
declare
  i      integer := 0;
  v_col  text;
  v_grp  text;
  v_val  text;
  v_row  jsonb := to_jsonb(new);
begin
  while i < tg_nargs loop
    v_col := tg_argv[i];
    v_grp := tg_argv[i + 1];
    v_val := v_row ->> v_col;
    if v_val is not null and not exists (
      select 1 from public.codes c where c.group_code = v_grp and c.code = v_val
    ) then
      raise exception '[%] %: 공통코드 %에 없는 값입니다. (%)', tg_table_name, v_col, v_grp, v_val
        using errcode = 'P0001';
    end if;
    i := i + 2;
  end loop;
  return new;
end;
$$;

revoke execute on function public.fn_enable_audit(text), public.fn_enable_history(text)
  from public;
