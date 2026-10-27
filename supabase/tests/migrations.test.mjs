// 마이그레이션 검증: PGlite 에 Supabase auth 스텁을 만들고 migrations/*.sql 적용 후 정합성·RLS·이력 시나리오 실행 (npm run test:db)
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const MIG = process.argv[2] ?? fileURLToPath(new URL('../migrations', import.meta.url))
const db = new PGlite()
let pass = 0,
  fail = 0
const ok = (name) => {
  pass++
  console.log('  PASS', name)
}
const ng = (name, e) => {
  fail++
  console.log('  FAIL', name, e ?? '')
}

async function expectOk(name, sql, params) {
  try {
    const r = await db.query(sql, params)
    ok(name)
    return r
  } catch (e) {
    ng(name, e.message)
  }
}
async function expectErr(name, sql, params, pattern) {
  try {
    await db.query(sql, params)
    ng(name, '(오류가 나야 하는데 성공함)')
  } catch (e) {
    if (!pattern || e.message.includes(pattern)) ok(`${name} → ${e.message}`)
    else ng(name, e.message)
  }
}
async function as(uid) {
  if (uid) {
    await db.exec(`set role authenticated`)
    await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid])
  } else {
    await db.exec(`reset role`)
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`)
  }
}
const check = (cond, okName, ngName, detail) => (cond ? ok(okName) : ng(ngName, detail))
const one = async (sql, p) => (await db.query(sql, p)).rows[0]

await db.exec(`
  create role anon; create role authenticated;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
`)

console.log('■ 마이그레이션 적용')
for (const f of fs
  .readdirSync(MIG)
  .filter((f) => f.endsWith('.sql'))
  .sort()) {
  try {
    await db.exec(fs.readFileSync(path.join(MIG, f), 'utf8'))
    ok(f)
  } catch (e) {
    ng(f, e.message)
    process.exit(1)
  }
}

console.log('■ 초기 데이터 / 이력')
const seed =
  await one(`select (select count(*) from codes) codes, (select count(*) from centers where is_default) centers,
  (select count(*) from codes_hist where hist_op='I') codes_hist, (select count(*) from company) company`)
check(
  seed.codes == 22 && seed.centers == 1 && seed.codes_hist == 22 && seed.company == 1,
  `공통코드 ${seed.codes}, 기본센터 ${seed.centers}, 이력 ${seed.codes_hist}`,
  '초기 데이터',
  JSON.stringify(seed),
)

const ADMIN = '00000000-0000-0000-0000-00000000000a'
const OPER = '00000000-0000-0000-0000-00000000000b'
const SA = '00000000-0000-0000-0000-00000000000c'
const SB = '00000000-0000-0000-0000-00000000000d'
await db.exec(
  `insert into auth.users values ('${ADMIN}','admin@t'),('${OPER}','op@t'),('${SA}','a@t'),('${SB}','b@t')`,
)
const { id: shipA } = await one(
  `insert into shippers (shipper_code, shipper_name) values ('SHA','화주A') returning id`,
)
const { id: shipB } = await one(
  `insert into shippers (shipper_code, shipper_name) values ('SHB','화주B') returning id`,
)
const { id: center } = await one(`select id from centers where is_default`)

console.log('■ 기준정보 제약')
await expectErr(
  '센터 기본값 2개 금지',
  `insert into centers (center_code, center_name, is_default) values ('C002','2센터',true)`,
)
await expectErr(
  '화주코드 형식',
  `insert into shippers (shipper_code, shipper_name) values ('sh a','x')`,
)
const itemA1 = await expectOk(
  '품목 등록(내부코드 자동채번)',
  `insert into items (shipper_id, shipper_item_code, item_name, barcode) values ($1,'P-001','사과','880001') returning id, internal_code`,
  [shipA],
)
console.log('    내부코드:', itemA1?.rows[0].internal_code)
await expectErr(
  '같은 화주 내 화주품목코드 중복',
  `insert into items (shipper_id, shipper_item_code, item_name) values ($1,'P-001','중복')`,
  [shipA],
  'items_shipper_item_code_uk',
)
await expectOk(
  '다른 화주는 같은 화주품목코드 허용',
  `insert into items (shipper_id, shipper_item_code, item_name, barcode) values ($1,'P-001','B사과','880001')`,
  [shipB],
)
await expectErr(
  '같은 화주 내 바코드 중복',
  `insert into items (shipper_id, shipper_item_code, item_name, barcode) values ($1,'P-002','배','880001')`,
  [shipA],
  'items_shipper_barcode_uk',
)
await expectErr(
  '없는 단위코드',
  `insert into items (shipper_id, shipper_item_code, item_name, uom_code) values ($1,'P-009','x','XX')`,
  [shipA],
  '공통코드',
)
const lotItem = await one(
  `insert into items (shipper_id, shipper_item_code, item_name, barcode, lot_yn, expiry_yn, uom_code) values ($1,'P-LOT','우유','880099',true,true,'BOX') returning id`,
  [shipA],
)
await expectErr(
  '품목 화주 변경 금지',
  `update items set shipper_id=$1 where id=$2`,
  [shipB, itemA1.rows[0].id],
  '변경할 수 없습니다',
)
const vA = await one(
  `insert into vehicles (shipper_id, vehicle_no, vehicle_type_code) values ($1,'12가 3456','WING') returning id, vehicle_no`,
  [shipA],
)
check(vA.vehicle_no === '12가3456', '차량번호 공백 제거', '차량번호 공백 제거', vA.vehicle_no)
const vB = await one(
  `insert into vehicles (shipper_id, vehicle_no) values ($1,'99나9999') returning id`,
  [shipB],
)

await expectOk(
  '관리자 프로필',
  `insert into profiles (id, login_id, user_name, user_type, role) values ($1,'admin@t','관리자','INTERNAL','ADMIN')`,
  [ADMIN],
)
await expectOk(
  '운영자 프로필',
  `insert into profiles (id, login_id, user_name, user_type, role) values ($1,'op@t','운영자','INTERNAL','OPERATOR')`,
  [OPER],
)
await expectOk(
  '화주A 사용자',
  `insert into profiles (id, login_id, user_name, user_type, role, shipper_id) values ($1,'a@t','화주A','SHIPPER','SHIPPER_USER',$2)`,
  [SA, shipA],
)
await expectErr(
  '화주 사용자 소속 누락',
  `insert into profiles (id, login_id, user_name, user_type, role) values ($1,'b@t','화주B','SHIPPER','SHIPPER_USER')`,
  [SB],
  'profiles_type_role_ck',
)
await expectErr(
  '내부 사용자에 화주 권한',
  `insert into profiles (id, login_id, user_name, user_type, role) values ($1,'b@t','x','INTERNAL','SHIPPER_USER')`,
  [SB],
  'profiles_type_role_ck',
)
await db.query(
  `insert into profiles (id, login_id, user_name, user_type, role, shipper_id) values ($1,'b@t','화주B','SHIPPER','SHIPPER_USER',$2)`,
  [SB, shipB],
)

console.log('■ 이력 (_hist)')
await as(ADMIN)
await expectOk('관리자 품목 수정', `update items set item_name='사과(특)' where id=$1`, [
  itemA1.rows[0].id,
])
await as(null)
const h = await db.query(
  `select hist_op, item_name, hist_by from items_hist where id=$1 order by hist_id`,
  [itemA1.rows[0].id],
)
check(
  h.rows.map((r) => r.hist_op).join('') === 'IU' && h.rows[1].hist_by === ADMIN,
  `items_hist: ${h.rows.map((r) => `${r.hist_op}:${r.item_name}`).join(', ')} / 변경자 기록`,
  'items_hist',
  JSON.stringify(h.rows),
)
const audit = await one(`select updated_by from items where id=$1`, [itemA1.rows[0].id])
check(audit.updated_by === ADMIN, 'updated_by 자동 기록', 'updated_by', audit.updated_by)

console.log('■ RLS')
await as(SA)
const ia = await one(
  `select count(*)::int n, count(*) filter (where shipper_id <> $1)::int other from items`,
  [shipA],
)
check(
  ia.other === 0 && ia.n === 2,
  `화주A 사용자는 자기 품목 ${ia.n}건만 조회`,
  '화주A 품목 조회',
  JSON.stringify(ia),
)
const sa = await one(`select count(*)::int n from shippers`)
check(sa.n === 1, '화주A 사용자는 자기 화주사만 조회', '화주사 조회', sa.n)
await expectErr(
  '화주 사용자는 다른 화주 품목 등록 불가',
  `insert into items (shipper_id, shipper_item_code, item_name) values ($1,'Z','z')`,
  [shipB],
  'row-level security',
)
const cmp = await one(`select count(*)::int n from company`)
check(cmp.n === 0, '화주 사용자는 회사정보 조회 불가', '회사정보', cmp.n)
const hh = await one(`select count(*)::int n from items_hist`)
check(hh.n === 0, '화주 사용자는 이력 조회 불가', '이력 조회', hh.n)
await as(OPER)
const io = await one(`select count(*)::int n from items`)
check(io.n === 3, '운영자는 전체 품목 조회', '운영자 조회', io.n)
const upd = await db.query(`update items set item_name='x' where id=$1`, [itemA1.rows[0].id])
check(upd.affectedRows === 0, '운영자는 품목 수정 불가(0건 반영)', '운영자 수정', upd.affectedRows)
await as(null)

console.log('■ 입고 전표 정합성')
await as(SA)
const plan = await expectOk(
  '화주A 입고예정 등록',
  `insert into inbound_plans (shipper_id, center_id, plan_date) values ($1,$2,current_date) returning id, plan_no, status`,
  [shipA, center],
)
const planId = plan.rows[0].id
console.log('    전표번호:', plan.rows[0].plan_no, plan.rows[0].status)
await expectErr(
  '등록 시 상태 임의 지정 불가',
  `insert into inbound_plans (shipper_id, center_id, plan_date, status) values ($1,$2,current_date,'APPROVED')`,
  [shipA, center],
  '등록 시 상태',
)
await as(OPER)
await expectErr(
  '화주B 품목으로 라인 등록 불가 (R2)',
  `insert into inbound_plan_lines (plan_id, line_no, item_id, plan_qty) select $1, 9, id, 1 from items where shipper_id=$2 limit 1`,
  [planId, shipB],
  '승인된 품목',
)
await as(SA)
const pl1 = await one(
  `insert into inbound_plan_lines (plan_id, line_no, item_id, plan_qty) values ($1,1,$2,100) returning id`,
  [planId, itemA1.rows[0].id],
)
const pl2 = await one(
  `insert into inbound_plan_lines (plan_id, line_no, item_id, plan_qty) values ($1,2,$2,10) returning id`,
  [planId, lotItem.id],
)
await expectErr(
  '상태 직접 변경 불가 (R12)',
  `update inbound_plans set status='APPROVED' where id=$1`,
  [planId],
  '업무 처리 함수',
)
await as(null)
// 승인 (다음 단계 RPC 역할을 트랜잭션으로 흉내)
await db.transaction(async (tx) => {
  await tx.query(`select fn_allow_status_change()`)
  await tx.query(`update inbound_plan_lines set approved_qty = plan_qty where plan_id=$1`, [planId])
  await tx.query(`update inbound_plans set status='APPROVED', approved_at=now() where id=$1`, [
    planId,
  ])
})
ok('승인 처리(RPC 흉내)')
await as(SA)
await expectErr(
  '승인 후 라인 수정 불가 (R1)',
  `update inbound_plan_lines set plan_qty=1 where id=$1`,
  [pl1.id],
  '라인을 변경할 수 없습니다',
)
await expectErr(
  '다른 화주 차량으로 ASN 불가 (R5)',
  `insert into asns (shipper_id, center_id, asn_date, vehicle_id) values ($1,$2,current_date,$3)`,
  [shipA, center, vB.id],
  '사용 중인 차량',
)
const asn1 = await one(
  `insert into asns (shipper_id, center_id, asn_date, vehicle_id) values ($1,$2,current_date,$3) returning id, asn_no, vehicle_no`,
  [shipA, center, vA.id],
)
const asn2 = await one(
  `insert into asns (shipper_id, center_id, asn_date, vehicle_id) values ($1,$2,current_date,$3) returning id`,
  [shipA, center, vA.id],
)
console.log('    ASN:', asn1.asn_no, '차량', asn1.vehicle_no)
await expectOk(
  '1호차 60 배정',
  `insert into asn_lines (asn_id, line_no, plan_line_id, item_id, order_qty) values ($1,1,$2,$3,60)`,
  [asn1.id, pl1.id, itemA1.rows[0].id],
)
await expectOk(
  '1호차 우유 10 배정',
  `insert into asn_lines (asn_id, line_no, plan_line_id, item_id, order_qty) values ($1,2,$2,$3,10)`,
  [asn1.id, pl2.id, lotItem.id],
)
await expectErr(
  '2호차 50 배정 → 승인 초과 (R4)',
  `insert into asn_lines (asn_id, line_no, plan_line_id, item_id, order_qty) values ($1,1,$2,$3,50)`,
  [asn2.id, pl1.id, itemA1.rows[0].id],
  '승인 수량을 초과',
)
await expectOk(
  '2호차 40 배정',
  `insert into asn_lines (asn_id, line_no, plan_line_id, item_id, order_qty) values ($1,1,$2,$3,40)`,
  [asn2.id, pl1.id, itemA1.rows[0].id],
)
let q = await one(`select asn_qty from inbound_plan_lines where id=$1`, [pl1.id])
check(q.asn_qty == 100, '입고예정 라인 asn_qty 자동 집계 = 100', 'asn_qty', q.asn_qty)
await as(null)
await db.transaction(async (tx) => {
  await tx.query(`select fn_allow_status_change()`)
  await tx.query(`update asns set status='CANCELLED' where id=$1`, [asn2.id])
})
q = await one(`select asn_qty from inbound_plan_lines where id=$1`, [pl1.id])
check(q.asn_qty == 60, 'ASN 취소 시 asn_qty 재집계 = 60', '취소 재집계', q.asn_qty)

// 상차
await as(SA)
const ld = await one(`insert into loadings (asn_id) values ($1) returning id, loading_no`, [
  asn1.id,
])
const al = (
  await db.query(`select id, item_id, order_qty from asn_lines where asn_id=$1 order by line_no`, [
    asn1.id,
  ])
).rows
await expectOk(
  '상차 라인 등록',
  `insert into loading_lines (loading_id, asn_line_id, item_id, loaded_qty) values ($1,$2,$3,60),($1,$4,$5,10)`,
  [ld.id, al[0].id, al[0].item_id, al[1].id, al[1].item_id],
)
q = await one(`select loaded_qty from asn_lines where id=$1`, [al[0].id])
check(q.loaded_qty == 60, 'asn_lines.loaded_qty 동기화', 'loaded_qty', q.loaded_qty)
await as(null)
await db.transaction(async (tx) => {
  await tx.query(`select fn_allow_status_change()`)
  await tx.query(`update loadings set status='COMPLETED', completed_at=now() where id=$1`, [ld.id])
  await tx.query(`update asns set status='LOADED' where id=$1`, [asn1.id])
})

// 검수
await as(SA)
await expectErr(
  '화주 사용자는 검수 등록 불가',
  `insert into receipts (asn_id, shipper_id, center_id) values ($1,$2,$3)`,
  [asn1.id, shipA, center],
  'row-level security',
)
await as(OPER)
const rc = await one(
  `insert into receipts (asn_id, shipper_id, center_id) values ($1,$2,$3) returning id, receipt_no`,
  [asn1.id, shipA, center],
)
await expectErr(
  '로트 관리 품목 로트 누락 (R9)',
  `insert into receipt_lines (receipt_id, asn_line_id, item_id, received_qty) values ($1,$2,$3,10)`,
  [rc.id, al[1].id, al[1].item_id],
  '로트번호',
)
await expectOk(
  '로트·유통기한 입력 후 검수',
  `insert into receipt_lines (receipt_id, asn_line_id, item_id, received_qty, lot_no, expiry_date) values ($1,$2,$3,10,'L001','2027-01-31')`,
  [rc.id, al[1].id, al[1].item_id],
)
await expectOk(
  '사과 55 입고 + 3 파손 반송',
  `insert into receipt_lines (receipt_id, asn_line_id, item_id, received_qty) values ($1,$2,$3,55),($1,$2,$3,0)`,
  [rc.id, al[0].id, al[0].item_id],
)
await db.query(
  `update receipt_lines set return_qty=3, result_code='DAMAGED', return_reason_code='DAMAGE' where receipt_id=$1 and received_qty=0`,
  [rc.id],
)
await expectErr(
  '없는 검수결과 코드',
  `update receipt_lines set result_code='XXX' where receipt_id=$1 and received_qty=0`,
  [rc.id],
  '공통코드',
)
q = await one(`select received_qty, return_qty, diff_qty from asn_lines where id=$1`, [al[0].id])
check(
  q.received_qty == 55 && q.return_qty == 3 && q.diff_qty == 2,
  `ASN 라인 집계: 입고 55, 반송 3, 차이 ${q.diff_qty}`,
  '검수 집계',
  JSON.stringify(q),
)

console.log('■ 전표 추적')
const tr = (
  await db.query(
    `select plan_no, asn_no, loading_no, receipt_no, item_name, approved_qty, order_qty, loaded_qty, received_qty, return_qty, diff_qty from v_doc_trace order by asn_line_no`,
  )
).rows
check(
  tr.length === 3 && tr.filter((r) => r.receipt_no).length === 2,
  'v_doc_trace IP→AS→LD→GR 연결 (취소 ASN 포함 3행)',
  'v_doc_trace',
  JSON.stringify(tr),
)
console.table(tr)
await as(SB)
const trB = await one(`select count(*)::int n from v_doc_trace`)
check(trB.n === 0, '화주B는 화주A 전표 추적 불가(RLS)', '추적 RLS', trB.n)
await as(null)

console.log('■ 삭제 보호 (R13)')
await expectErr('진행된 입고예정 라인 삭제 불가', `delete from inbound_plan_lines where id=$1`, [
  pl1.id,
])

console.log('■ 3단계: 화주 품목 등록·승인')
await as(SA)
const pend = await one(
  `insert into items (shipper_id, shipper_item_code, item_name, barcode) values ($1,'NEW-1','신규품목','990001') returning id, approval_status`,
  [shipA],
)
check(
  pend.approval_status === 'PENDING',
  '화주 등록 품목은 승인대기',
  '화주 품목 상태',
  pend.approval_status,
)
await expectErr(
  '화주가 승인 상태 직접 변경 불가',
  `update items set approval_status='APPROVED' where id=$1`,
  [pend.id],
  '승인·반려 처리로만',
)
await expectErr(
  '화주는 품목 승인 불가',
  `select approve_items(array[$1]::uuid[])`,
  [pend.id],
  '권한이 없습니다',
)
const planX = await one(
  `insert into inbound_plans (shipper_id, center_id, plan_date) values ($1,$2,current_date) returning id`,
  [shipA, center],
)
await expectErr(
  '미승인 품목은 입고예정에 사용 불가',
  `insert into inbound_plan_lines (plan_id, line_no, item_id, plan_qty) values ($1,1,$2,5)`,
  [planX.id, pend.id],
  '승인된 품목',
)
await as(OPER)
await expectErr('반려 사유 필수(품목)', `select reject_item($1, ' ')`, [pend.id], '반려 사유')
const ap = await one(`select approve_items(array[$1]::uuid[]) n`, [pend.id])
check(ap.n === 1, '운영자 품목 승인', '품목 승인', ap.n)
await as(SA)
await db.query(`update items set item_name='신규품목(변경)' where id=$1`, [pend.id])
const re = await one(`select approval_status from items where id=$1`, [pend.id])
check(
  re.approval_status === 'PENDING',
  '승인 후 화주 수정 → 재승인 대기',
  '재승인',
  re.approval_status,
)
await as(OPER)
await expectOk('운영자 품목 반려', `select reject_item($1, '바코드 확인 필요')`, [pend.id])
await as(ADMIN)
const adm = await one(
  `insert into items (shipper_id, shipper_item_code, item_name) values ($1,'ADM-1','관리자등록') returning approval_status`,
  [shipA],
)
check(
  adm.approval_status === 'APPROVED',
  '관리자 등록 품목은 즉시 승인',
  '관리자 등록',
  adm.approval_status,
)
await as(null)
const ih = await one(
  `select count(*)::int n, string_agg(hist_op || ':' || approval_status, ',' order by hist_id) ops from items_hist where id=$1`,
  [pend.id],
)
check(ih.n >= 4, `품목 승인 이력 보존 (${ih.ops})`, '품목 이력', ih.ops)
const oldHist = await one(`select count(*)::int n from items_hist where id=$1 and hist_op='I'`, [
  itemA1.rows[0].id,
])
check(oldHist.n === 1, '이력 테이블 재구성 후 기존 이력 유지', '기존 이력', oldHist.n)

console.log('■ 3단계: 화주 차량 등록 (화주 간 중복 허용)')
await as(SB)
await expectOk(
  '화주B가 화주A와 같은 차량번호 등록',
  `insert into vehicles (shipper_id, vehicle_no) values ($1,'12가 3456')`,
  [shipB],
)
await expectErr(
  '같은 화주 안에서 차량번호 중복 불가',
  `insert into vehicles (shipper_id, vehicle_no) values ($1,'12가3456')`,
  [shipB],
  'vehicles_shipper_vehicle_no_uk',
)
await expectErr(
  '다른 화주 차량 등록 불가',
  `insert into vehicles (shipper_id, vehicle_no) values ($1,'77다7777')`,
  [shipA],
  'row-level security',
)
const vb = await one(`select count(*)::int n from vehicles`)
check(vb.n === 2, '화주B는 자기 차량만 조회 (화주A 차량 숨김)', '차량 조회', vb.n)
await as(ADMIN)
const shared = await one(
  `select count(distinct shipper_id)::int n from vehicles where vehicle_no='12가3456'`,
)
check(shared.n === 2, '관리자는 같은 차량번호의 화주 2곳 확인', '공유 차량', shared.n)
await as(null)

console.log('■ 3단계: 입고예정 저장·승인 RPC')
await as(SA)
const items2 = (
  await db.query(
    `select id from items where shipper_id=$1 and approval_status='APPROVED' and is_active order by internal_code limit 2`,
    [shipA],
  )
).rows
const planId2 = (
  await one(`select save_inbound_plan(null, $1, current_date, '1차', 'MANUAL', $2::jsonb) id`, [
    shipA,
    JSON.stringify([
      { item_id: items2[0].id, plan_qty: 100 },
      { item_id: items2[1].id, plan_qty: 20 },
    ]),
  ])
).id
ok('save_inbound_plan 등록')
await expectErr(
  '같은 품목 중복 라인 불가',
  `select save_inbound_plan($1, $2, current_date, null, 'MANUAL', $3::jsonb)`,
  [
    planId2,
    shipA,
    JSON.stringify([
      { item_id: items2[0].id, plan_qty: 1 },
      { item_id: items2[0].id, plan_qty: 2 },
    ]),
  ],
  'inbound_plan_lines_item_uk',
)
await expectErr(
  '과거 일자 불가',
  `select save_inbound_plan(null, $1, current_date - 1, null, 'MANUAL', $2::jsonb)`,
  [shipA, JSON.stringify([{ item_id: items2[0].id, plan_qty: 1 }])],
  '오늘 이후',
)
await expectOk(
  '승인대기 중 수정(라인 교체)',
  `select save_inbound_plan($1, $2, current_date, '1차 수정', 'MANUAL', $3::jsonb)`,
  [
    planId2,
    shipA,
    JSON.stringify([
      { item_id: items2[0].id, plan_qty: 120 },
      { item_id: items2[1].id, plan_qty: 20 },
    ]),
  ],
)
const lines2 = (
  await db.query(
    `select id, line_no, plan_qty from inbound_plan_lines where plan_id=$1 order by line_no`,
    [planId2],
  )
).rows
check(
  lines2.length === 2 && lines2[0].plan_qty == 120,
  '수정 후 라인 2건, 1번 120',
  '수정 결과',
  JSON.stringify(lines2),
)
await expectErr(
  '화주는 입고 승인 불가',
  `select approve_inbound_plan($1, '[]'::jsonb)`,
  [planId2],
  '권한이 없습니다',
)
await as(OPER)
const L = (q1, r1, q2, r2) =>
  JSON.stringify([
    { line_id: lines2[0].id, approved_qty: q1, adjust_reason: r1 },
    { line_id: lines2[1].id, approved_qty: q2, adjust_reason: r2 },
  ])
await expectErr(
  '예정 초과 승인 불가',
  `select approve_inbound_plan($1, $2::jsonb)`,
  [planId2, L(121, null, 20, null)],
  '0 ~',
)
await expectErr(
  '감량 시 사유 필수',
  `select approve_inbound_plan($1, $2::jsonb)`,
  [planId2, L(100, null, 20, null)],
  '조정 사유',
)
await expectErr(
  '전부 0이면 반려 안내',
  `select approve_inbound_plan($1, $2::jsonb)`,
  [planId2, L(0, '공간부족', 0, '공간부족')],
  '반려하세요',
)
await expectOk('라인 조정 후 최종 승인', `select approve_inbound_plan($1, $2::jsonb)`, [
  planId2,
  L(100, '적재공간 부족', 20, null),
])
const ap2 = await one(
  `select status, approved_by, total_approved_qty, approved_by_name from v_inbound_plans where id=$1`,
  [planId2],
)
check(
  ap2.status === 'APPROVED' && ap2.approved_by === OPER && ap2.total_approved_qty == 120,
  `승인 완료: 승인수량 합계 ${ap2.total_approved_qty}, 승인자 ${ap2.approved_by_name}`,
  '승인 결과',
  JSON.stringify(ap2),
)
await as(SA)
await expectErr(
  '승인 후 화주 취소 불가',
  `select cancel_inbound_plan($1)`,
  [planId2],
  '승인대기 상태에서만',
)
const planId3 = (
  await one(`select save_inbound_plan(null, $1, current_date + 1, null, 'EXCEL', $2::jsonb) id`, [
    shipA,
    JSON.stringify([{ item_id: items2[0].id, plan_qty: 5 }]),
  ])
).id
await expectOk('승인대기 화주 취소', `select cancel_inbound_plan($1)`, [planId3])
await as(SB)
const vSB = await one(`select count(*)::int n from v_inbound_plans`)
check(vSB.n === 0, '화주B는 화주A 입고예정 목록 조회 불가', '목록 RLS', vSB.n)
await expectErr(
  '화주B는 화주A 전표 취소 불가',
  `select cancel_inbound_plan($1)`,
  [planId2],
  '찾을 수 없습니다',
)
await as(OPER)
const planId4 = (
  await one(
    `select save_inbound_plan(null, $1, current_date, '3PL 대리 등록', 'MANUAL', $2::jsonb) id`,
    [shipA, JSON.stringify([{ item_id: items2[0].id, plan_qty: 1 }])],
  )
).id
await expectErr(
  '반려 사유 필수(입고)',
  `select reject_inbound_plan($1, '')`,
  [planId4],
  '반려 사유',
)
await expectOk('3PL 반려', `select reject_inbound_plan($1, '당일 입고 마감')`, [planId4])
await as(null)

console.log('■ 이력 테이블 재구성 (기존 이력이 있는 상태)')
await as(null)
const histBefore = await one(`select count(*)::int n, max(hist_id)::int m from items_hist`)
await db.query(`alter table items add column tmp_flag text not null default 'x'`)
await expectOk('필수 컬럼 추가 후 재구성', `select fn_rebuild_history('items')`)
await db.query(`alter table items drop column tmp_flag`)
await expectOk('컬럼 삭제 후 재구성', `select fn_rebuild_history('items')`)
const histAfter = await one(`select count(*)::int n, max(hist_id)::int m from items_hist`)
check(
  histAfter.n === histBefore.n && histAfter.m === histBefore.m,
  `기존 이력 ${histAfter.n}건·hist_id 보존`,
  '이력 보존',
  JSON.stringify({ histBefore, histAfter }),
)
await db.query(`update items set remark='재구성 후 변경' where id=$1`, [itemA1.rows[0].id])
const histNew = await one(
  `select hist_id::int id, hist_op from items_hist order by hist_id desc limit 1`,
)
check(
  histNew.id === histBefore.m + 1 && histNew.hist_op === 'U',
  '재구성 후 새 이력 정상 적재',
  '새 이력',
  JSON.stringify(histNew),
)

console.log(`\n결과: PASS ${pass} / FAIL ${fail}`)
process.exit(fail ? 1 : 0)
