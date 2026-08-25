import { loginUser } from '../../../actions/auth';
import { cookies } from 'next/headers';
import { createClient } from '../../../lib/supabase/server';

export async function GET() {
  const formData = new FormData();
  formData.append('email', 'freddie@gmail.com');
  formData.append('password', 'password'); // assuming this is the password

  const supabase = await createClient();
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'freddie@gmail.com',
      password: 'password'
    });
    
    if (data.user) {
      const domain = 'localhost';
      const websiteId = process.env.WEBSITE_ID;
      
      let query = supabase
        .from('user_roles')
        .select(`
          user_profiles!inner (
            user_id
          ),
          website_roles!inner (
            role,
            website_id,
            websites!inner (
              subdomain
            )
          )
        `)
        .eq('user_profiles.user_id', data.user.id);

      if (websiteId) {
        query = query.eq('website_roles.website_id', websiteId);
      } else {
        query = query.eq('website_roles.websites.subdomain', domain);
      }

      const { data: roleData, error: roleError } = await query.single();
      
      return Response.json({ success: true, roleData, roleError, websiteId });
    }
  } catch (e: any) {
    if (e.message === 'NEXT_REDIRECT') {
      return Response.json({ success: true, redirect: true });
    }
    return Response.json({ error: e.message, stack: e.stack });
  }
}
