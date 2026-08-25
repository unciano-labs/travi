import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
    const websiteId = process.env.WEBSITE_ID;

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
      
    if (roleError) {
      console.error('MIDDLEWARE ROLE ERROR:', roleError);
    }
      
    if (roleData && roleData.length > 0) {
      roles = roleData.map((r: any) => r.website_roles.role);
    }
    console.log('MIDDLEWARE USER ROLES:', roles, 'WEBSITE_ID:', websiteId);
  }

  const { pathname } = request.nextUrl

  // --- Admin Routes ---
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    if (!user || !roles.includes('admin')) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
  }

  if (pathname.startsWith('/admin/login')) {
    if (user && roles.includes('admin')) {
      return NextResponse.redirect(new URL('/admin', request.url))
    }
  }

  // --- Dashboard Routes (Traveler, Organizer, Transporter) ---
  if (pathname.startsWith('/dashboard')) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
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
    if (user) {
      if (roles.includes('admin')) {
        return NextResponse.redirect(new URL('/admin', request.url))
      } else if (roles.length > 0) {
        const primaryRole = roles.includes('traveler') ? 'traveler' : roles[0];
        return NextResponse.redirect(new URL(`/dashboard/${primaryRole}`, request.url))
      }
    }
  }

  return supabaseResponse
}
