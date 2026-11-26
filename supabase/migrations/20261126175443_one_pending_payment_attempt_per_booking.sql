-- A booking may have only one unresolved provider attempt at a time.
-- This prevents parallel M-Pesa and PayPal checkouts from charging the same guest.
create unique index if not exists payments_one_pending_attempt_per_booking
  on public.payments (booking_id)
  where status = 'pending';
