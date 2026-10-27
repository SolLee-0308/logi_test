-- =============================================================
-- 09. 회사정보 상세: 법인등록번호, 설립일, 우편번호·상세주소, 팩스, 회사 CI 이미지
--     address 컬럼은 기본주소(주소 검색 결과)로 사용
-- =============================================================

alter table public.company
  add column corp_no          varchar(14) check (corp_no ~ '^\d{6}-\d{7}$'),
  add column established_date date,
  add column zip_code         varchar(5)  check (zip_code ~ '^\d{5}$'),
  add column address_detail   varchar(200),
  add column fax              varchar(20),
  add column ci_image_path    text;

comment on column public.company.address is '기본주소 (주소 검색 결과)';
comment on column public.company.ci_image_path is 'Storage company-assets 버킷 내 경로';

select public.fn_rebuild_history('company');

-- ---------- Storage 버킷: company-assets (공개 조회, 관리자만 업로드·삭제) ----------
-- 회사 CI는 출력물에도 쓰이므로 공개 URL로 조회한다. (storage 스키마가 없는 테스트 DB에서는 건너뜀)
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    execute $q$
      insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      values ('company-assets', 'company-assets', true, 2097152,
              array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
      on conflict (id) do nothing
    $q$;
    -- 삭제·덮어쓰기 API 는 조회 권한도 필요
    execute $q$
      create policy company_assets_select on storage.objects for select to authenticated
      using (bucket_id = 'company-assets')
    $q$;
    execute $q$
      create policy company_assets_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'company-assets' and public.is_admin())
    $q$;
    execute $q$
      create policy company_assets_update on storage.objects for update to authenticated
      using (bucket_id = 'company-assets' and public.is_admin())
    $q$;
    execute $q$
      create policy company_assets_delete on storage.objects for delete to authenticated
      using (bucket_id = 'company-assets' and public.is_admin())
    $q$;
  end if;
end;
$$;
