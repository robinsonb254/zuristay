-- Prevent two simultaneous, unresolved M-Pesa STK requests for one booking.
create unique index if not exists payments_one_pending_mpesa_per_booking
  on public.payments (booking_id)
  where payment_method = 'mpesa' and status = 'pending';
