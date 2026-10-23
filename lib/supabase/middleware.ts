import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { env } from '../env'
import { safeNextPath } from '../safe-next'
import { adminMfaPath, getAdminMfaState } from '../admin-mfa'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let roles: string[] = [];
  if (user) {
    const websiteId = env.WEBSITE_ID;

    // Use websiteId if available, fallback to not filtering by domain if missing (for safety, though it should exist)
    let query = supabase
      .from('user_roles')
      .select(`
        user_profiles!inner (
          user_id
        ),
        website_roles!inner (
          role,
          website_id
        )
      `)
      .eq('user_profiles.user_id', user.id);

    if (websiteId) {
      query = query.eq('website_roles.website_id', websiteId);
    }

    const { data: roleData, error: roleError } = await query;
      
    if (roleData && roleData.length > 0) {
      roles = roleData.map((r: any) => r.website_roles.role);
    }
  }

  const { pathname } = request.nextUrl

  // Redirect while keeping any session cookies refreshed by getUser() above.
  const redirectTo = (path: string) => {
    const response = NextResponse.redirect(new URL(path, request.url))
    supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie))
    return response
  }

  // --- Admin Routes ---
  const isAdminLogin = pathname.startsWith('/admin/login')
  if (pathname.startsWith('/admin') && !isAdminLogin) {
    if (!user || !roles.includes('admin')) {
      return redirectTo('/admin/login')
    }

    // SEC-12: the admin console requires an MFA-verified (aal2) session. The enrol/verify pages
    // are the only /admin pages reachable at aal1.
    const mfaPath = adminMfaPath(await getAdminMfaState(supabase, user))
    if (pathname.startsWith('/admin/mfa')) {
      if (!mfaPath) return redirectTo('/admin')
      if (!pathname.startsWith(mfaPath)) return redirectTo(mfaPath)
    } else if (mfaPath) {
      return redirectTo(mfaPath)
    }
  }

  if (isAdminLogin) {
    if (user && roles.includes('admin')) {
      return redirectTo(adminMfaPath(await getAdminMfaState(supabase, user)) ?? '/admin')
    }
  }

  // --- Dashboard Routes (Traveler, Organizer, Transporter) ---
  if (pathname.startsWith('/dashboard')) {
    if (!user) {
      // Come back here after signing in (validated again on /login).
      const loginUrl = new URL('/login', request.url)
      const next = safeNextPath(`${pathname}${request.nextUrl.search}`)
      if (next && next !== '/dashboard') loginUrl.searchParams.set('next', next)
      return NextResponse.redirect(loginUrl)
    }

    // Prevent cross-role access, or block admin from accessing standard dashboards directly
    if (roles.length === 0 || roles.includes('admin')) {
      // Admins should go to /admin, others to /login if they somehow lack a role
      if (roles.includes('admin')) return NextResponse.redirect(new URL('/admin', request.url))
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Check which dashboard they are trying to access
    let requestedRole = 'traveler';
    if (pathname.startsWith('/dashboard/organizer')) requestedRole = 'organizer';
    else if (pathname.startsWith('/dashboard/transporter')) requestedRole = 'transporter';

    // If they don't have the requested role, redirect to their primary role's dashboard
    if (!roles.includes(requestedRole)) {
      const primaryRole = roles.includes('traveler') ? 'traveler' : roles[0];
      return NextResponse.redirect(new URL(`/dashboard/${primaryRole}`, request.url));
    }
  }

  if (pathname === '/login') {
    if (user && roles.length > 0) {
      // Already signed in: honour a safe relative ?next=, else go to the role home.
      const next = safeNextPath(request.nextUrl.searchParams.get('next'))
      if (next) {
        return NextResponse.redirect(new URL(next, request.url))
      }
      if (roles.includes('admin')) {
        return NextResponse.redirect(new URL('/admin', request.url))
      }
      const primaryRole = roles.includes('traveler') ? 'traveler' : roles[0];
      return NextResponse.redirect(new URL(`/dashboard/${primaryRole}`, request.url))
    }
  }

  return supabaseResponse
}
