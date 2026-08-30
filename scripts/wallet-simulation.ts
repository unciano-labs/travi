import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { subDays } from 'date-fns';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase configuration.');
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, supabaseServiceKey);

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runSimulation() {
  console.log('--- STARTING WALLET SIMULATION ---');

  // 1. Get or Create Users
  console.log('\n[1] Finding Organizer Profile...');
  
  let { data: organizerProfile } = await adminClient.from('organizer_profiles').select('id, user_profile_id').limit(1).single();
  let userProfileId;
  
  if (!organizerProfile) {
    const uniqueId = Date.now();
    console.log(`No organizer found. Creating one via Auth API with email org-${uniqueId}@test.com...`);
    const authRes = await adminClient.auth.admin.createUser({
      email: `org-${uniqueId}@test.com`,
      password: 'password123',
      email_confirm: true,
      user_metadata: { role: 'organizer', full_name: 'Test Organizer' }
    });
    
    if (authRes.error) {
       console.error('Failed to create auth user', authRes.error);
       process.exit(1);
    }
    const userId = authRes.data.user.id;
    await sleep(1000); // give trigger time to run if it exists
    
    // Fetch or create userProfile
    let { data: userProfile } = await adminClient.from('user_profiles').select('id').eq('user_id', userId).single();
    if (!userProfile) {
        const { data: newProfile, error: upErr } = await adminClient.from('user_profiles').insert({
            user_id: userId,
            email: authRes.data.user.email,
            full_name: 'Test Organizer'
        }).select('id').single();
        if (upErr) { console.error('user_profiles insert failed:', upErr); process.exit(1); }
        userProfile = newProfile;
    }

    // Check if organizer_profile exists
    let { data: existingOrg } = await adminClient.from('organizer_profiles').select('id').eq('user_profile_id', userProfile.id).single();
    if (existingOrg) {
       const { data: orgProfile, error: orgErr } = await adminClient.from('organizer_profiles').update({
         organizer_type: 'company',
         company_name: 'Test Org Inc',
         display_name: 'Test Org',
         phone: '1234567890',
         status: 'approved'
       }).eq('user_profile_id', userProfile.id).select().single();
       if (orgErr) { console.error(orgErr); process.exit(1); }
       organizerProfile = orgProfile;
    } else {
       const { data: orgProfile, error: orgErr } = await adminClient.from('organizer_profiles').insert({
         user_profile_id: userProfile.id,
         organizer_type: 'company',
         company_name: 'Test Org Inc',
         display_name: 'Test Org',
         phone: '1234567890',
         status: 'approved'
       }).select().single();
       if (orgErr) { console.error(orgErr); process.exit(1); }
       organizerProfile = orgProfile;
    }
    userProfileId = userProfile.id;
    userProfileId = userProfile!.id;
  } else {
    await adminClient.from('organizer_profiles').update({ status: 'approved' }).eq('id', organizerProfile.id);
    userProfileId = organizerProfile.user_profile_id;
  }

  const organizerId = organizerProfile!.id;
  if (!organizerProfile) { throw new Error('No organizer'); }
  console.log(`Organizer: ${organizerProfile.id}`);

  // 2. Ensure Wallet Exists
  console.log('\n[2] Ensuring Organizer Wallet Exists...');
  let { data: wallet, error: walletErr } = await adminClient.from('user_wallets').select('*').eq('user_profile_id', userProfileId).single();
  
  if (!wallet) {
     const { data: newWallet, error: newWalletErr } = await adminClient.from('user_wallets').insert({ user_profile_id: userProfileId }).select().single();
     if (newWalletErr) {
        console.error('Failed to create/get wallet:', newWalletErr);
        process.exit(1);
     }
     wallet = newWallet;
  }
  const walletId = wallet!.id;
  console.log(`Organizer Wallet ID: ${walletId}`);

  // Fetch initial balances
  let { data: initialWallet } = await adminClient.from('user_wallets').select('available_balance, escrow_balance').eq('id', walletId).single();
  console.log(`Initial balances: Available=${initialWallet?.available_balance || 0}, Escrow=${initialWallet?.escrow_balance || 0}`);

  // 3. Create a Dummy Booking
  console.log('\n[3] Creating a Dummy Booking...');
  const bookingRef = `TS${Date.now().toString().slice(-6)}`; // Max 10 chars
  const totalAmount = 5000;
  
  console.log('Creating a new tour and schedule for simulation...');
  let resTour = await adminClient.from('tours').insert({
    organizer_id: organizerId,
    title: 'Test Tour',
    slug: 'test-tour-' + Date.now(),
    description: 'Test tour for wallet simulation',
    location: 'Test location',
    city: 'Manila',
    province: 'Metro Manila',
    format: 'joiner',
    themes: ['adventure'],
    status: 'published',
    price_per_person: 2500,
    duration_days: 1
  }).select().single();
  
  if (resTour.error) {
     console.error("Failed to create tour:", resTour.error);
     process.exit(1);
  }
  
  let resSchedule = await adminClient.from('tour_schedules').insert({
    tour_id: resTour.data.id,
    start_date: new Date().toISOString(),
    end_date: new Date().toISOString(),
    capacity: 10,
    price_per_person: 2500,
    transport_type: 'none',
    transport_status: 'not_required',
    status: 'open'
  }).select().single();

  if (resSchedule.error) {
     console.error("Failed to create tour schedule:", resSchedule.error);
     process.exit(1);
  }
  
  const scheduleId = resSchedule.data.id;

  let { data: traveler } = await adminClient.from('user_profiles').select('id').limit(1);
  if (!traveler || traveler.length === 0) {
    const uniqueId = Date.now();
    console.log(`No traveler found. Creating one via Auth API with email traveler-${uniqueId}@test.com...`);
    const authRes = await adminClient.auth.admin.createUser({
      email: `traveler-${uniqueId}@test.com`,
      password: 'password123',
      email_confirm: true,
      user_metadata: { role: 'traveler', full_name: 'Test Traveler' }
    });
    
    if (authRes.error) {
       console.error('Failed to create traveler auth user', authRes.error);
       process.exit(1);
    }
    const userId = authRes.data.user.id;
    await sleep(1000);
    
    let { data: travelerProfile } = await adminClient.from('user_profiles').select('id').eq('user_id', userId).single();
    if (!travelerProfile) {
        const { data: newProfile, error: upErr } = await adminClient.from('user_profiles').insert({
            user_id: userId,
            email: authRes.data.user.email,
            full_name: 'Test Traveler'
        }).select('id').single();
        if (upErr) { console.error('traveler user_profiles insert failed:', upErr); process.exit(1); }
        travelerProfile = newProfile;
    }
    
    traveler = [travelerProfile!];
  }

  const { data: booking, error: bookErr } = await adminClient.from('bookings').insert({
    booking_ref: bookingRef,
    tour_schedule_id: scheduleId,
    traveler_id: traveler[0].id,
    seats: 2,
    total_amount: totalAmount,
    status: 'pending'
  }).select().single();

  if (bookErr) {
    console.error('Failed to create booking:', bookErr);
    process.exit(1);
  }
  console.log(`Created Booking: ${booking.id} (Ref: ${bookingRef}) for ₱${totalAmount}`);

  // 4. Trigger the Webhook manually to process payment
  console.log('\n[4] Simulating Payment Webhook (Escrow Split)...');
  // @ts-ignore
  const fetch = require('node-fetch').default;
  const res = await fetch('http://localhost:3000/api/webhooks/paymongo', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      data: {
        attributes: {
          type: 'payment.paid',
          data: {
            attributes: {
              reference_number: bookingRef,
              amount: totalAmount * 100 // Paymongo sends in cents
            }
          }
        }
      }
    })
  });
  const hookResult = await res.json();
  console.log('Webhook Response:', hookResult);

  await sleep(1000); // give it a sec

  // Check balances
  let { data: postHookWallet } = await adminClient.from('user_wallets').select('available_balance, escrow_balance').eq('id', walletId).single();
  console.log(`Post-Webhook balances: Available=${postHookWallet?.available_balance || 0}, Escrow=${postHookWallet?.escrow_balance || 0}`);

  // 5. Update booking to trick cron into thinking the tour is finished and holding period is over
  console.log('\n[5] Time-traveling booking to bypass Escrow Holding Period...');
  await adminClient.from('bookings').update({ status: 'confirmed' }).eq('id', booking.id);
  // Also we need the schedule to be completed
  await adminClient.from('tour_schedules').update({
    end_date: subDays(new Date(), 5).toISOString()
  }).eq('id', scheduleId);

  // 6. Run Cron Job
  console.log('\n[6] Running Escrow Release Cron Job...');
  const cronRes = await fetch('http://localhost:3000/api/cron/escrow-release', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${process.env.CRON_SECRET}`
    }
  });
  const cronText = await cronRes.text();
  try {
      const cronJson = JSON.parse(cronText);
      console.log('Cron Response:', cronJson);
  } catch(e) {
      console.log('Cron Raw Response:', cronText);
  }

  // Check balances again
  let { data: postCronWallet } = await adminClient.from('user_wallets').select('available_balance, escrow_balance').eq('id', walletId).single();
  console.log(`Post-Cron balances: Available=${postCronWallet?.available_balance || 0}, Escrow=${postCronWallet?.escrow_balance || 0}`);

  console.log('\n--- SIMULATION COMPLETE ---');
  process.exit(0);
}

runSimulation().catch(console.error);
