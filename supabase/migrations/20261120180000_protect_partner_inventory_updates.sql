CREATE OR REPLACE FUNCTION public.partner_set_unit_availability(
    p_partner_id uuid,
    p_unit_id uuid,
    p_start_date date,
    p_end_date date,
    p_available_units integer,
    p_partner_base_rate numeric
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_total_units integer;
    v_currency text;
    v_date date;
    v_reserved_units integer;
    v_updated integer := 0;
BEGIN
    IF p_partner_id IS NULL
       OR p_unit_id IS NULL
       OR p_start_date IS NULL
       OR p_end_date IS NULL
       OR p_available_units IS NULL
       OR p_partner_base_rate IS NULL
    THEN
        RAISE EXCEPTION 'Required availability information is missing.';
    END IF;

    IF p_start_date < CURRENT_DATE
       OR p_end_date < p_start_date
       OR p_end_date > p_start_date + 365
    THEN
        RAISE EXCEPTION 'Choose a valid date range of no more than 366 days.';
    END IF;

    IF p_available_units < 0 OR p_partner_base_rate <= 0 THEN
        RAISE EXCEPTION 'Available rooms cannot be negative and the nightly rate must be positive.';
    END IF;

    SELECT u.total_units, u.currency
    INTO v_total_units, v_currency
    FROM public.property_units u
    JOIN public.properties p ON p.id = u.property_id
    WHERE u.id = p_unit_id
      AND p.partner_id = p_partner_id
      AND p.status = 'approved'
    FOR SHARE OF u, p;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Approved partner room category not found.';
    END IF;

    IF p_available_units > v_total_units THEN
        RAISE EXCEPTION 'Available rooms cannot exceed the total room count.';
    END IF;

    -- Release expired holds before calculating inventory already committed.
    PERFORM public.expire_booking_holds();

    FOR v_date IN
        SELECT dates.stay_date::date
        FROM pg_catalog.generate_series(
            p_start_date::timestamp,
            p_end_date::timestamp,
            interval '1 day'
        ) AS dates(stay_date)
        ORDER BY dates.stay_date
    LOOP
        -- Ensure a row exists, then serialize edits against booking holds.
        INSERT INTO public.unit_availability (
            unit_id, stay_date, available_units, partner_base_rate, currency
        )
        VALUES (
            p_unit_id, v_date, 0, p_partner_base_rate, v_currency
        )
        ON CONFLICT (unit_id, stay_date) DO NOTHING;

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

        IF v_reserved_units > v_total_units THEN
            RAISE EXCEPTION 'Existing reservations exceed room inventory for %; contact support.', v_date;
        END IF;

        IF p_available_units > v_total_units - v_reserved_units THEN
            RAISE EXCEPTION
                'Only % room(s) can be made available on % because other rooms are already reserved or on hold.',
                v_total_units - v_reserved_units,
                v_date;
        END IF;

        UPDATE public.unit_availability
        SET available_units = p_available_units,
            partner_base_rate = p_partner_base_rate,
            currency = v_currency
        WHERE unit_id = p_unit_id
          AND stay_date = v_date;

        v_updated := v_updated + 1;
    END LOOP;

    RETURN v_updated;
END;
$function$;

REVOKE ALL ON FUNCTION public.partner_set_unit_availability(uuid, uuid, date, date, integer, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.partner_set_unit_availability(uuid, uuid, date, date, integer, numeric) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.partner_set_unit_availability(uuid, uuid, date, date, integer, numeric) TO service_role;
