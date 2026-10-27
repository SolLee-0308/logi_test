// 사용자 관리 Edge Function (관리자 전용)
//   create         : 로그인 계정(auth.users) + 프로필 생성
//   update         : 프로필 수정 + 사용여부에 따라 로그인 차단/해제
//   reset_password : 비밀번호 초기화
// 프로필 저장은 호출자 토큰으로 수행해 감사 컬럼·이력에 관리자 ID가 남도록 한다.
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const BAN_FOREVER = '876000h' // 100년

type ProfileInput = {
  user_name: string
  user_type: 'INTERNAL' | 'SHIPPER'
  role: string
  shipper_id: string | null
  tel: string | null
  is_active: boolean
}

type Body =
  | ({ action: 'create'; email: string; password: string } & ProfileInput)
  | ({ action: 'update'; id: string } & ProfileInput)
  | { action: 'reset_password'; id: string; password: string }

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'POST만 허용됩니다.' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const authHeader = req.headers.get('Authorization') ?? ''

  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

  // 호출자가 활성 관리자(INTERNAL/ADMIN)인지 확인
  const { data: userData } = await caller.auth.getUser()
  if (!userData.user) return json({ error: '로그인이 필요합니다.' }, 401)
  const { data: me } = await caller
    .from('profiles')
    .select('user_type, role, is_active')
    .eq('id', userData.user.id)
    .maybeSingle()
  if (!me || !me.is_active || me.user_type !== 'INTERNAL' || me.role !== 'ADMIN') {
    return json({ error: '관리자만 사용할 수 있습니다.' }, 403)
  }

  let body: Body
  try {
    body = await req.json()
  } catch {
    return json({ error: '요청 형식이 올바르지 않습니다.' }, 400)
  }

  const profileFields = (b: ProfileInput) => ({
    user_name: b.user_name,
    user_type: b.user_type,
    role: b.role,
    shipper_id: b.user_type === 'SHIPPER' ? b.shipper_id : null,
    tel: b.tel || null,
    is_active: b.is_active,
  })

  if (body.action === 'create') {
    if (!body.email || !body.password || body.password.length < 8) {
      return json({ error: '이메일과 8자 이상의 비밀번호가 필요합니다.' }, 400)
    }
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      ban_duration: body.is_active ? 'none' : BAN_FOREVER,
    })
    if (createError) return json({ error: createError.message }, 400)

    const { error: profileError } = await caller
      .from('profiles')
      .insert({ id: created.user.id, login_id: body.email, ...profileFields(body) })
    if (profileError) {
      await admin.auth.admin.deleteUser(created.user.id) // 계정 생성 되돌림
      return json({ error: profileError.message, code: profileError.code }, 400)
    }
    return json({ id: created.user.id })
  }

  if (body.action === 'update') {
    const { error: profileError } = await caller.from('profiles').update(profileFields(body)).eq('id', body.id)
    if (profileError) return json({ error: profileError.message, code: profileError.code }, 400)
    const { error: banError } = await admin.auth.admin.updateUserById(body.id, {
      ban_duration: body.is_active ? 'none' : BAN_FOREVER,
    })
    if (banError) return json({ error: banError.message }, 400)
    return json({ id: body.id })
  }

  if (body.action === 'reset_password') {
    if (!body.password || body.password.length < 8) return json({ error: '비밀번호는 8자 이상이어야 합니다.' }, 400)
    const { error } = await admin.auth.admin.updateUserById(body.id, { password: body.password })
    if (error) return json({ error: error.message }, 400)
    return json({ id: body.id })
  }

  return json({ error: '알 수 없는 작업입니다.' }, 400)
})
