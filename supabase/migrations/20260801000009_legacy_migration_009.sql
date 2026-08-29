-- Migration 009: Add original_price to tour_schedules for markdown pricing

ALTER TABLE tour_schedules
ADD COLUMN original_price NUMERIC(10, 2) NULL;
