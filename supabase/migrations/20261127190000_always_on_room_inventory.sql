-- Always-on room inventory defaults with booking-time daily stock creation.

CREATE OR REPLACE FUNCTION public.partner_update_unit_defaults(
  p_partner_id uuid,
  p_unit_id uuid,
  p_total_units integer,
  p_partner_base_rate numeric
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_currency text;
  v_date date;
  v_reserved_units integer;
  v_updated integer := 0;
BEGIN
  IF p_partner_id IS NULL OR p_unit_id IS NULL
     OR p_total_units IS NULL OR p_partner_base_rate IS NULL THEN
    RAISE EXCEPTION 'Room count and 24-hour rate are required.';
  END IF;

  IF p_total_units < 1 OR p_total_units > 500 THEN
    RAISE EXCEPTION 'Available rooms must be between 1 and 500.';
  END IF;
  IF p_partner_base_rate <= 0 OR p_partner_base_rate > 100000000 THEN
    RAISE EXCEPTION 'Enter a valid positive 24-hour rate.';
  END IF;

  PERFORM public.expire_booking_holds();

  SELECT u.currency
  INTO v_currency
  FROM public.property_units u
  JOIN public.properties p ON p.id = u.property_id
  WHERE u.id = p_unit_id
    AND p.partner_id = p_partner_id
  FOR UPDATE OF u;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Partner room category not found.';
  END IF;

  FOR v_date IN
    SELECT ua.stay_date
    FROM public.unit_availability ua
    WHERE ua.unit_id = p_unit_id
      AND ua.stay_date >= CURRENT_DATE
    ORDER BY ua.stay_date
  LOOP
    PERFORM 1
    FROM public.unit_availability ua
    WHERE ua.unit_id = p_unit_id
      AND ua.stay_date = v_date
    FOR UPDATE;

    SELECT COALESCE(SUM(h.quantity), 0)::integer
    INTO v_reserved_units
    FROM public.booking_holds h
    WHERE h.unit_id = p_unit_id
      AND h.stay_date = v_date
      AND h.status IN ('active', 'converted');

    IF v_reserved_units > p_total_units THEN
      RAISE EXCEPTION
        'The new room count is lower than the rooms already reserved on %. Increase the room count or contact support.',
        v_date;
    END IF;

    UPDATE public.unit_availability
    SET available_units = p_total_units - v_reserved_units,
        partner_base_rate = ROUND(p_partner_base_rate, 2),
        currency = v_currency
    WHERE unit_id = p_unit_id
      AND stay_date = v_date;

    v_updated := v_updated + 1;
  END LOOP;

  UPDATE public.property_units
  SET total_units = p_total_units,
      base_rate = ROUND(p_partner_base_rate, 2)
  WHERE id = p_unit_id;

  RETURN v_updated;
END;
$function$;

REVOKE ALL ON FUNCTION public.partner_update_unit_defaults(uuid, uuid, integer, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.partner_update_unit_defaults(uuid, uuid, integer, numeric) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.partner_update_unit_defaults(uuid, uuid, integer, numeric) TO service_role;

CREATE OR REPLACE FUNCTION public.create_booking_hold_with_policy_secure(
  p_unit_id uuid,
  p_check_in date,
  p_check_out date,
  p_quantity integer,
  p_guests integer,
  p_guest_name text,
  p_guest_email text,
  p_guest_phone text,
  p_idempotency_key uuid,
  p_customer_user_id uuid,
  p_special_requests text,
  p_guest_access_token_hash text,
  p_policy_version text,
  p_policy_accepted boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_result jsonb;
  v_booking_id uuid;
  v_property_id uuid;
  v_check_in_time time;
  v_total_units integer;
  v_base_rate numeric;
  v_currency text;
BEGIN
  IF p_policy_accepted IS NOT TRUE OR p_policy_version <> '2026-11-25' THEN
    RAISE EXCEPTION 'You must accept the current ZuriStay Worldwide cancellation and refund policy before booking.';
  END IF;
  IF p_guest_access_token_hash IS NULL OR p_guest_access_token_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'A valid guest access token hash is required.';
  END IF;
  IF p_unit_id IS NULL OR p_check_in IS NULL OR p_check_out IS NULL
     OR p_check_in < CURRENT_DATE OR p_check_out <= p_check_in
     OR p_check_out > p_check_in + 30 THEN
    RAISE EXCEPTION 'Invalid booking dates. Stays must be between 1 and 30 nights.';
  END IF;

  SELECT u.property_id, u.total_units, u.base_rate, u.currency, p.check_in_time
  INTO v_property_id, v_total_units, v_base_rate, v_currency, v_check_in_time
  FROM public.property_units u
  JOIN public.properties p ON p.id = u.property_id
  WHERE u.id = p_unit_id
    AND u.active = true
    AND p.status = 'approved'
    AND p.is_active = true
    AND p.is_archived = false
  FOR SHARE OF u, p;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The selected accommodation is not available.';
  END IF;
  IF v_check_in_time IS NULL THEN
    RAISE EXCEPTION 'The accommodation check-in time is not configured.';
  END IF;

  -- Missing dates inherit the room category's always-on inventory and 24-hour rate.
  -- Existing rows retain their live available count, which booking holds decrement atomically.
  INSERT INTO public.unit_availability (
    unit_id, stay_date, available_units, partner_base_rate, currency
  )
  SELECT
    p_unit_id,
    dates.stay_date::date,
    v_total_units,
    v_base_rate,
    v_currency
  FROM pg_catalog.generate_series(
    p_check_in::timestamp,
    (p_check_out - 1)::timestamp,
    interval '1 day'
  ) AS dates(stay_date)
  ON CONFLICT (unit_id, stay_date) DO NOTHING;

  v_result := public.create_booking_hold(
    p_unit_id, p_check_in, p_check_out, p_quantity, p_guests,
    p_guest_name, p_guest_email, p_guest_phone, p_idempotency_key,
    p_customer_user_id, p_special_requests
  );

  IF COALESCE((v_result->>'success')::boolean, false) IS NOT TRUE
     OR v_result->>'booking_id' IS NULL THEN
    RAISE EXCEPTION 'The booking hold could not be secured.';
  END IF;

  v_booking_id := (v_result->>'booking_id')::uuid;

  UPDATE public.bookings
  SET guest_access_token_hash = p_guest_access_token_hash,
      cancellation_policy_version = p_policy_version,
      cancellation_policy_accepted_at = COALESCE(cancellation_policy_accepted_at, now()),
      scheduled_check_in_at = ((p_check_in::timestamp + v_check_in_time) AT TIME ZONE 'Africa/Nairobi')
  WHERE id = v_booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The secure booking access and check-in time could not be stored.';
  END IF;

  RETURN v_result;
END;
$function$;
