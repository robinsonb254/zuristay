update public.partner_settlements ps
set status='awaiting_confirmations', eligible_at=null
from public.bookings b
where ps.booking_id=b.id
  and ps.status='awaiting_checkout'
  and b.payment_status='paid'
  and b.booking_status='confirmed';