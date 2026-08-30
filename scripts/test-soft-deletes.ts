import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = (process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase configuration');
  process.exit(1);
}

const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

async function runSoftDeleteVerification() {
  console.log('\n======================================================');
  console.log('  🗑️ LIVE SOFT DELETE LIFECYCLE VERIFICATION');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  async function assertStep(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ❌ [FAIL] ${name}: ${err.message || err}`);
      failed++;
    }
  }

  // 1. Fetch an organizer profile and tour for foreign key associations
  const { data: tour } = await adminSupabase
    .from('tours')
    .select('id, organizer_id')
    .limit(1)
    .single();

  if (!tour) {
    console.error('❌ Could not find a tour for testing foreign keys.');
    process.exit(1);
  }

  const { data: userProfile } = await adminSupabase
    .from('user_profiles')
    .select('id')
    .limit(1)
    .single();

  const { data: transporterProfile } = await adminSupabase
    .from('transporter_profiles')
    .select('id')
    .limit(1)
    .single();

  console.log(`📌 Using Test Fixtures: Tour ID = ${tour.id}`);

  // Test 1: Tour Schedule Lifecycle
  console.log('\n--- 1. Testing Tour Schedule Soft-Delete ---');
  let scheduleId: string | null = null;

  await assertStep('Create a new schedule', async () => {
    const { data, error } = await adminSupabase
      .from('tour_schedules')
      .insert({
        tour_id: tour.id,
        start_date: '2027-12-01',
        end_date: '2027-12-03',
        capacity: 15,
        price_per_person: 2500,
        status: 'open',
      })
      .select('id, deleted_at')
      .single();

    if (error || !data) throw error || new Error('Insert failed');
    scheduleId = data.id;
    if (data.deleted_at !== null) throw new Error('New schedule must have deleted_at = null');
  });

  await assertStep('Soft delete the schedule (set deleted_at & status: cancelled)', async () => {
    const deletedTimestamp = new Date().toISOString();
    const { error } = await adminSupabase
      .from('tour_schedules')
      .update({
        deleted_at: deletedTimestamp,
        status: 'cancelled',
      })
      .eq('id', scheduleId);

    if (error) throw error;
  });

  await assertStep('Verify soft-deleted schedule still exists in raw DB', async () => {
    const { data, error } = await adminSupabase
      .from('tour_schedules')
      .select('id, deleted_at, status')
      .eq('id', scheduleId)
      .single();

    if (error || !data) throw error || new Error('Row was hard deleted!');
    if (!data.deleted_at) throw new Error('deleted_at timestamp was not recorded!');
    if (data.status !== 'cancelled') throw new Error('status was not updated to cancelled!');
  });

  await assertStep('Verify soft-deleted schedule is EXCLUDED from active queries (deleted_at IS NULL)', async () => {
    const { data, error } = await adminSupabase
      .from('tour_schedules')
      .select('id')
      .eq('id', scheduleId)
      .is('deleted_at', null);

    if (error) throw error;
    if (data && data.length > 0) throw new Error('Soft-deleted schedule was returned in active query!');
  });

  // Clean up schedule
  if (scheduleId) {
    await adminSupabase.from('tour_schedules').delete().eq('id', scheduleId);
  }

  // Test 2: Review Soft-Delete
  console.log('\n--- 2. Testing Review Soft-Delete ---');
  let reviewId: string | null = null;

  if (userProfile) {
    await assertStep('Create a published review', async () => {
      const { data, error } = await adminSupabase
        .from('reviews')
        .insert({
          reviewer_profile_id: userProfile.id,
          tour_id: tour.id,
          rating: 5,
          comment: 'Temporary QA soft-delete test review',
          status: 'published',
        })
        .select('id, deleted_at')
        .single();

      if (error || !data) throw error || new Error('Insert review failed');
      reviewId = data.id;
    });

    await assertStep('Soft delete the review (set deleted_at & status: hidden)', async () => {
      const { error } = await adminSupabase
        .from('reviews')
        .update({
          deleted_at: new Date().toISOString(),
          status: 'hidden',
        })
        .eq('id', reviewId);

      if (error) throw error;
    });

    await assertStep('Verify soft-deleted review is preserved with deleted_at timestamp', async () => {
      const { data, error } = await adminSupabase
        .from('reviews')
        .select('id, deleted_at, status')
        .eq('id', reviewId)
        .single();

      if (error || !data) throw error || new Error('Row was hard deleted!');
      if (!data.deleted_at) throw new Error('deleted_at timestamp missing on review!');
    });

    await assertStep('Verify soft-deleted review is excluded from active public review queries', async () => {
      const { data, error } = await adminSupabase
        .from('reviews')
        .select('id')
        .eq('id', reviewId)
        .is('deleted_at', null);

      if (error) throw error;
      if (data && data.length > 0) throw new Error('Soft-deleted review appeared in active query!');
    });

    if (reviewId) {
      await adminSupabase.from('reviews').delete().eq('id', reviewId);
    }
  }

  // Test 3: Vehicle Soft-Delete
  console.log('\n--- 3. Testing Vehicle Soft-Delete ---');
  let vehicleId: string | null = null;

  if (transporterProfile) {
    await assertStep('Create an active vehicle', async () => {
      const { data, error } = await adminSupabase
        .from('vehicles')
        .insert({
          transporter_id: transporterProfile.id,
          name: 'QA Test Van',
          vehicle_type: 'van',
          seat_capacity: 12,
          status: 'active',
        })
        .select('id, deleted_at')
        .single();

      if (error || !data) throw error || new Error('Insert vehicle failed');
      vehicleId = data.id;
    });

    await assertStep('Soft delete vehicle (status: archived, deleted_at = now())', async () => {
      const { error } = await adminSupabase
        .from('vehicles')
        .update({
          deleted_at: new Date().toISOString(),
          status: 'archived',
        })
        .eq('id', vehicleId);

      if (error) throw error;
    });

    await assertStep('Verify vehicle is preserved in database with deleted_at timestamp', async () => {
      const { data, error } = await adminSupabase
        .from('vehicles')
        .select('id, deleted_at, status')
        .eq('id', vehicleId)
        .single();

      if (error || !data) throw error;
      if (!data.deleted_at) throw new Error('deleted_at timestamp missing on vehicle!');
      if (data.status !== 'archived') throw new Error('Vehicle status is not archived!');
    });

    await assertStep('Verify archived vehicle is excluded from active vehicle list', async () => {
      const { data, error } = await adminSupabase
        .from('vehicles')
        .select('id')
        .eq('id', vehicleId)
        .is('deleted_at', null)
        .eq('status', 'active');

      if (error) throw error;
      if (data && data.length > 0) throw new Error('Soft-deleted vehicle was returned in active query!');
    });

    if (vehicleId) {
      await adminSupabase.from('vehicles').delete().eq('id', vehicleId);
    }
  }

  // Test 4: Tour Soft-Delete & Restore
  console.log('\n--- 4. Testing Tour Archive & Restore Lifecycle ---');
  let testTourId: string | null = null;

  await assertStep('Create a test tour package', async () => {
    const { data, error } = await adminSupabase
      .from('tours')
      .insert({
        organizer_id: tour.organizer_id,
        title: 'QA Soft Delete Test Tour',
        slug: `qa-soft-delete-tour-${Date.now()}`,
        description: 'Testing soft delete lifecycle',
        location: 'Test Location',
        price_per_person: 1000,
        duration_days: 2,
        transport_type: 'none',
        status: 'published',
      })
      .select('id, deleted_at')
      .single();

    if (error || !data) throw error || new Error('Tour insert failed');
    testTourId = data.id;
  });

  await assertStep('Archive tour (soft-delete)', async () => {
    const { error } = await adminSupabase
      .from('tours')
      .update({
        status: 'archived',
        deleted_at: new Date().toISOString(),
      })
      .eq('id', testTourId);

    if (error) throw error;
  });

  await assertStep('Verify archived tour is excluded from active queries', async () => {
    const { data, error } = await adminSupabase
      .from('tours')
      .select('id')
      .eq('id', testTourId)
      .is('deleted_at', null);

    if (error) throw error;
    if (data && data.length > 0) throw new Error('Archived tour appeared in active queries!');
  });

  await assertStep('Restore tour (un-archive, clear deleted_at)', async () => {
    const { error } = await adminSupabase
      .from('tours')
      .update({
        status: 'published',
        deleted_at: null,
      })
      .eq('id', testTourId);

    if (error) throw error;
  });

  await assertStep('Verify restored tour is visible again in active queries', async () => {
    const { data, error } = await adminSupabase
      .from('tours')
      .select('id, status, deleted_at')
      .eq('id', testTourId)
      .is('deleted_at', null)
      .single();

    if (error || !data) throw error || new Error('Restored tour not found!');
    if (data.deleted_at !== null) throw new Error('deleted_at was not cleared!');
  });

  if (testTourId) {
    await adminSupabase.from('tours').delete().eq('id', testTourId);
  }

  // Summary
  console.log('\n======================================================');
  console.log(`  📊 RESULTS: Passed: ${passed} | Failed: ${failed}`);
  console.log('======================================================\n');

  if (failed > 0) {
    console.error('❌ Soft delete lifecycle verification failed.');
    process.exit(1);
  } else {
    console.log('🎉 All Soft Delete Lifecycle Tests Passed Successfully!\n');
    process.exit(0);
  }
}

runSoftDeleteVerification().catch(err => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
