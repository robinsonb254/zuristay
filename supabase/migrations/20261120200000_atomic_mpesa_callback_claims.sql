ALTER TABLE public.mpesa_callback_events
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz;

CREATE OR REPLACE FUNCTION public.claim_mpesa_callback_event(p_event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_claimed boolean := false;
BEGIN
  UPDATE public.mpesa_callback_events
  SET processing_status = 'processing',
      processing_attempts = processing_attempts + 1,
      processing_started_at = now(),
      last_error = null
  WHERE id = p_event_id
    AND processing_status <> 'processed'
    AND (
      processing_status <> 'processing'
      OR processing_started_at IS NULL
      OR processing_started_at < now() - interval '5 minutes'
    );

  GET DIAGNOSTICS v_claimed = ROW_COUNT;
  RETURN v_claimed;
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_mpesa_callback_event(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_mpesa_callback_event(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_mpesa_callback_event(uuid) TO service_role;
