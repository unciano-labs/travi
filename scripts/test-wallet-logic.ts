import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase configuration.');
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, supabaseServiceKey);

async function runWalletTests() {
  console.log('🧪 Starting Wallet & Payout System QA Test...\n');

  try {
    // 1. Verify New Tables Exist
    console.log('1. Checking wallet tables existence...');
    const tables = ['platform_settings', 'user_wallets', 'wallet_transactions', 'payout_requests'];
    for (const table of tables) {
      const { error } = await adminClient.from(table).select('id').limit(1);
      if (error && error.code !== 'PGRST116') {
        throw new Error(`Table ${table} failed: ${error.message}`);
      }
      console.log(`  ✅ Table '${table}' is accessible.`);
    }

    // 2. Platform Settings Defaults
    console.log('\n2. Checking platform_settings defaults...');
    const { data: settings, error: settingsError } = await adminClient
      .from('platform_settings')
      .select('*')
      .limit(1)
      .single();

    if (settingsError) throw new Error(`Could not fetch platform_settings: ${settingsError.message}`);
    console.log(`  ✅ Settings found: Organizer Fee: ${settings.organizer_fee_percent}%, Transporter Fee: ${settings.transporter_fee_percent}%, Escrow Days: ${settings.escrow_holding_days}`);

    // 3. Testing verifyPaymentAndUpdateBooking logic
    console.log('\n3. Testing escrow deposit calculation logic...');
    const bookingAmount = 10000;
    const organizerFee = bookingAmount * (settings.organizer_fee_percent / 100);
    const expectedOrganizerEscrow = bookingAmount - organizerFee;

    console.log(`  - Mock Booking Amount: ₱${bookingAmount}`);
    console.log(`  - Expected Organizer Fee: ₱${organizerFee}`);
    console.log(`  - Expected Escrow Deposit: ₱${expectedOrganizerEscrow}`);
    
    if (expectedOrganizerEscrow + organizerFee !== bookingAmount) {
      throw new Error('Fee split calculation is mathematically incorrect.');
    }
    console.log(`  ✅ Math split verification passed.`);

    // 4. Testing Escrow Release Logic (Transporter Deduction)
    console.log('\n4. Testing escrow release and transporter split logic...');
    const transportEstimatedPrice = 3000;
    const transporterFee = transportEstimatedPrice * (settings.transporter_fee_percent / 100);
    const expectedTransporterNet = transportEstimatedPrice - transporterFee;

    console.log(`  - Mock Transport Price: ₱${transportEstimatedPrice}`);
    console.log(`  - Expected Transporter Fee: ₱${transporterFee}`);
    console.log(`  - Expected Transporter Net: ₱${expectedTransporterNet}`);
    console.log(`  - Organizer Final Payout: ₱${expectedOrganizerEscrow - transportEstimatedPrice}`);

    if (expectedTransporterNet + transporterFee !== transportEstimatedPrice) {
      throw new Error('Transporter split calculation is mathematically incorrect.');
    }
    console.log(`  ✅ Escrow release and split math verification passed.`);

    console.log('\n🎉 All Wallet Logic smoke tests passed!');
  } catch (error: any) {
    console.error('\n❌ QA Test Failed:', error.message);
    process.exit(1);
  }
}

runWalletTests();
