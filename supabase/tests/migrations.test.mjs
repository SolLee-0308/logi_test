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
  '화주 사용자는 품목 등록 불가',
  `insert into items (shipper_id, shipper_item_code, item_name) values ($1,'Z','z')`,
  [shipA],
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
  '사용 중인 품목',
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

console.log(`\n결과: PASS ${pass} / FAIL ${fail}`)
process.exit(fail ? 1 : 0)
