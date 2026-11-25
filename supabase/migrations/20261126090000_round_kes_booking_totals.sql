-- Keep KES booking totals aligned with the whole-shilling amount supported by M-Pesa.
-- The database remains the source of truth for the partner subtotal, 15% markup,
-- guest total, and partner payable. Other currencies retain two-decimal pricing.

DO $migration$
DECLARE
  v_definition text;
  v_pattern text := 'v_base_total := v_base_per_room \* p_quantity;\s*v_markup_total := v_base_total \* v_commission_rate;\s*v_guest_per_room := v_base_per_room \* \(1 \+ v_commission_rate\);\s*v_guest_total := v_guest_per_room \* p_quantity;';
  v_new text := E'IF v_unit_currency = ''KES'' THEN\n        -- KES has no minor unit: round the partner subtotal and markup to whole shillings.\n        v_base_total := pg_catalog.round(v_base_per_room * p_quantity, 0);\n        v_base_per_room := v_base_total / p_quantity;\n        v_markup_total := pg_catalog.round(v_base_total * v_commission_rate, 0);\n        v_guest_total := v_base_total + v_markup_total;\n        v_guest_per_room := v_guest_total / p_quantity;\n    ELSE\n        v_base_total := v_base_per_room * p_quantity;\n        v_markup_total := v_base_total * v_commission_rate;\n        v_guest_per_room := v_base_per_room * (1 + v_commission_rate);\n        v_guest_total := v_guest_per_room * p_quantity;\n    END IF;';
  v_updated text;
BEGIN
  v_definition := pg_catalog.pg_get_functiondef(
    'public.create_booking_hold(uuid,date,date,integer,integer,text,text,text,uuid,uuid,text)'::regprocedure
  );
  v_updated := pg_catalog.regexp_replace(v_definition, v_pattern, v_new);
  IF v_updated = v_definition THEN
    -- A previously applied migration is safe to re-run.
    IF pg_catalog.position('KES has no minor unit' in v_definition) > 0 THEN
      RETURN;
    END IF;
    RAISE EXCEPTION 'Expected booking pricing calculation was not found; migration stopped without changes.';
  END IF;
  EXECUTE v_updated;
END;
$migration$;
