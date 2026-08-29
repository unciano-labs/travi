import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixOverbooking() {
  console.log("Fetching all schedules and bookings...");
  
  // Get all schedules
  const { data: schedules, error: schedError } = await supabase
    .from('tour_schedules')
    .select('id, capacity, tour_id, booked_count')
    .eq('status', 'open');
    
  if (schedError) throw schedError;
  
  // Get all bookings
  const { data: bookings, error: bookError } = await supabase
    .from('bookings')
    .select('id, tour_schedule_id, seats, status')
    .in('status', ['pending', 'confirmed', 'completed']);
    
  if (bookError) throw bookError;
  
  const scheduleMap = new Map(schedules.map(s => [s.id, { ...s, currentBooked: 0, bookings: [] }]));
  
  for (const b of bookings) {
    const s = scheduleMap.get(b.tour_schedule_id);
    if (s) {
      s.currentBooked += b.seats;
      s.bookings.push(b);
    }
  }
  
  const overbookedSchedules = Array.from(scheduleMap.values()).filter(s => s.currentBooked > s.capacity);
  
  console.log(`Found ${overbookedSchedules.length} overbooked schedules.`);
  
  for (const s of overbookedSchedules) {
    let excess = s.currentBooked - s.capacity;
    console.log(`Schedule ${s.id} is overbooked by ${excess} seats (Capacity: ${s.capacity}, Booked: ${s.currentBooked}).`);
    
    // Sort bookings by seats (smallest first to fit better, or just move any)
    s.bookings.sort((a, b) => a.seats - b.seats);
    
    const bookingsToMove = [];
    while (excess > 0 && s.bookings.length > 0) {
      const b = s.bookings.pop();
      if (b) {
        bookingsToMove.push(b);
        excess -= b.seats;
        s.currentBooked -= b.seats;
      }
    }
    
    // Find new schedules for the bookings
    for (const b of bookingsToMove) {
      // Find a schedule with capacity >= b.seats
      let newSchedule = Array.from(scheduleMap.values()).find(
        other => other.id !== s.id && other.tour_id === s.tour_id && (other.capacity - other.currentBooked) >= b.seats
      );
      
      // If none found for the same tour, find ANY schedule
      if (!newSchedule) {
        newSchedule = Array.from(scheduleMap.values()).find(
          other => other.id !== s.id && (other.capacity - other.currentBooked) >= b.seats
        );
      }
      
      if (newSchedule) {
        console.log(`Moving booking ${b.id} (${b.seats} seats) to schedule ${newSchedule.id}`);
        await supabase
          .from('bookings')
          .update({ tour_schedule_id: newSchedule.id })
          .eq('id', b.id);
          
        newSchedule.currentBooked += b.seats;
        newSchedule.bookings.push(b);
      } else {
        console.log(`Could not find a schedule with enough capacity for booking ${b.id} (${b.seats} seats). Canceling it instead.`);
        await supabase
          .from('bookings')
          .update({ status: 'canceled' })
          .eq('id', b.id);
      }
    }
  }
  
  console.log("Updating booked_count on all schedules...");
  for (const s of scheduleMap.values()) {
    await supabase
      .from('tour_schedules')
      .update({ booked_count: s.currentBooked })
      .eq('id', s.id);
  }
  
  console.log("Done fixing overbookings.");
}

fixOverbooking();
