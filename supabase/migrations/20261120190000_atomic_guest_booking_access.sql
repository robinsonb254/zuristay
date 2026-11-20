CREATE OR REPLACE FUNCTION public.create_booking_hold_secure(
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
    p_guest_access_token_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_result jsonb;
    v_booking_id uuid;
BEGIN
    IF p_guest_access_token_hash IS NULL
       OR p_guest_access_token_hash !~ '^[0-9a-f]{64}$'
    THEN
        RAISE EXCEPTION 'A valid guest access token hash is required.';
    END IF;

    -- The existing booking function handles idempotency, inventory locks,
    -- pricing, and temporary holds. This wrapper shares its transaction.
    v_result := public.create_booking_hold(
        p_unit_id,
        p_check_in,
        p_check_out,
        p_quantity,
        p_guests,
        p_guest_name,
        p_guest_email,
        p_guest_phone,
        p_idempotency_key,
        p_customer_user_id,
        p_special_requests
    );

    IF COALESCE((v_result ->> 'success')::boolean, false) IS NOT TRUE
       OR v_result ->> 'booking_id' IS NULL
    THEN
        RAISE EXCEPTION 'The booking hold could not be secured.';
    END IF;

    v_booking_id := (v_result ->> 'booking_id')::uuid;

    UPDATE public.bookings
    SET guest_access_token_hash = p_guest_access_token_hash
    WHERE id = v_booking_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'The booking access credential could not be stored.';
    END IF;

    RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_booking_hold_secure(uuid, date, date, integer, integer, text, text, text, uuid, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_booking_hold_secure(uuid, date, date, integer, integer, text, text, text, uuid, uuid, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_booking_hold_secure(uuid, date, date, integer, integer, text, text, text, uuid, uuid, text, text) TO service_role;
