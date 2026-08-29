-- Enable pg_cron if not enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create the function that expires pending bookings older than 15 minutes
CREATE OR REPLACE FUNCTION expire_pending_bookings()
RETURNS void AS $$
BEGIN
    UPDATE bookings
    SET status = 'canceled',
        updated_at = NOW()
    WHERE status = 'pending'
    AND created_at < NOW() - INTERVAL '15 minutes';
END;
$$ LANGUAGE plpgsql;

-- Schedule the cron job to run every minute
SELECT cron.schedule(
    'expire-pending-bookings',
    '* * * * *',
    $$SELECT expire_pending_bookings()$$
);
