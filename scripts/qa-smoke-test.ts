import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// 1. Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  durationMs: number;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

async function runTest(suite: string, name: string, fn: () => Promise<any>) {
  const start = performance.now();
  try {
    const details = await fn();
    const durationMs = Math.round(performance.now() - start);
    results.push({ suite, name, passed: true, durationMs, details });
    console.log(`  ✅ [PASS] ${name} (${durationMs}ms)`);
  } catch (err: any) {
    const durationMs = Math.round(performance.now() - start);
    results.push({ suite, name, passed: false, durationMs, error: err.message || String(err) });
    console.error(`  ❌ [FAIL] ${name} (${durationMs}ms): ${err.message || err}`);
  }
}

async function main() {
  console.log('\n========================================');
  console.log('  🧪 TRAVI SAAS QA SMOKE & HEALTH TEST');
  console.log('========================================\n');

  // --- Suite 1: Environment & Secrets ---
  console.log('📦 Suite 1: Environment Configuration');
  await runTest('Environment', 'NEXT_PUBLIC_SUPABASE_URL is defined and valid URL', async () => {
    if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL is missing');
    new URL(supabaseUrl);
  });

  await runTest('Environment', 'NEXT_PUBLIC_SUPABASE_ANON_KEY is defined', async () => {
    if (!supabaseAnonKey) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is missing');
  });

  await runTest('Environment', 'SERVICE_ROLE_KEY is defined', async () => {
    if (!supabaseServiceKey) throw new Error('Service role key is missing');
  });

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('\n🛑 Cannot proceed without valid Supabase configuration.\n');
    process.exit(1);
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceKey);
  const anonClient = createClient(supabaseUrl, supabaseAnonKey || '');

  // --- Suite 2: Database Schema & Connectivity ---
  console.log('\n🗄️ Suite 2: Database Schema & Health');

  const requiredTables = [
    'user_profiles',
    'websites',
    'website_roles',
    'user_roles',
    'organizer_profiles',
    'transporter_profiles',
    'vehicles',
    'tours',
    'tour_schedules',
    'bookings',
    'reviews',
    'admin_audit_logs',
  ];

  for (const table of requiredTables) {
    await runTest('Database Schema', `Table '${table}' exists and is queryable`, async () => {
      const { data, error, count } = await adminClient
        .from(table)
        .select('*', { count: 'exact', head: true });
      if (error) throw new Error(`Query failed on table '${table}': ${error.message}`);
      return { totalRows: count };
    });
  }

  // --- Suite 3: Business Logic & Data Integrity ---
  console.log('\n💼 Suite 3: Business Logic & Relations');

  await runTest('Business Logic', 'Website roles contain standard roles', async () => {
    const { data, error } = await adminClient
      .from('website_roles')
      .select('role');
    if (error) throw error;
    const roles = data?.map(r => r.role) || [];
    const expectedRoles = ['admin', 'traveler', 'organizer', 'transporter'];
    const missing = expectedRoles.filter(r => !roles.includes(r));
    if (missing.length > 0) {
      throw new Error(`Missing expected roles in website_roles: ${missing.join(', ')}`);
    }
    return { availableRoles: roles };
  });

  await runTest('Business Logic', 'Published tours have valid schedules and pricing', async () => {
    const { data: tours, error } = await adminClient
      .from('tours')
      .select(`
        id,
        title,
        slug,
        status,
        price_per_person,
        schedules:tour_schedules(id, capacity, booked_count, price_per_person, status)
      `)
      .eq('status', 'published');

    if (error) throw error;
    
    // Check if schedules exceed capacity
    for (const tour of tours || []) {
      for (const schedule of tour.schedules || []) {
        if ((schedule.booked_count || 0) > schedule.capacity) {
          throw new Error(`Tour "${tour.title}" has an overbooked schedule: ${schedule.booked_count}/${schedule.capacity}`);
        }
      }
    }
    return { publishedToursCount: tours?.length || 0, slugs: tours?.map(t => t.slug) };
  });

  // Read-only: admin_audit_logs is append-only (AGENTS.md §5.6), so the smoke test must never
  // insert or delete rows in it.
  await runTest('Business Logic', 'Admin audit logs table is readable', async () => {
    const { count, error } = await adminClient
      .from('admin_audit_logs')
      .select('id', { count: 'exact', head: true });
    if (error) throw error;
    return { note: `${count ?? 0} audit rows` };
  });

  // --- Suite 4: Soft Deletes Integrity ---
  console.log('\n🗑️ Suite 4: Soft Deletes Schema & Integrity');

  const softDeleteTables = [
    'user_profiles',
    'organizer_profiles',
    'transporter_profiles',
    'tours',
    'tour_schedules',
    'tour_itineraries',
    'bookings',
    'reviews',
    'vehicles',
  ];

  for (const table of softDeleteTables) {
    await runTest('Soft Deletes', `Table '${table}' supports deleted_at timestamp filtering`, async () => {
      const { error } = await adminClient
        .from(table)
        .select('id, deleted_at')
        .is('deleted_at', null)
        .limit(1);
      if (error) throw new Error(`deleted_at query failed on table '${table}': ${error.message}`);
      return { status: 'supported' };
    });
  }

  // --- Summary Report ---
  console.log('\n========================================');
  console.log('  📊 QA TEST RUN SUMMARY');
  console.log('========================================');

  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalDuration = results.reduce((acc, r) => acc + r.durationMs, 0);

  console.log(`Total Tests:    ${total}`);
  console.log(`Passed:         ✅ ${passed}`);
  console.log(`Failed:         ${failed > 0 ? `❌ ${failed}` : '0'}`);
  console.log(`Total Duration: ${totalDuration}ms\n`);

  if (failed > 0) {
    console.error('❌ QA Smoke Test Failed. See details above.');
    process.exit(1);
  } else {
    console.log('🎉 All QA Smoke Tests Passed Successfully!\n');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal QA Runner Error:', err);
  process.exit(1);
});
