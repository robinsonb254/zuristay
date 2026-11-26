ALTER TABLE public.booking_receipts
  ADD COLUMN IF NOT EXISTS email_started_at timestamptz;

CREATE OR REPLACE FUNCTION public.claim_booking_receipt_email(p_receipt_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_claimed uuid;
BEGIN
  UPDATE public.booking_receipts
  SET email_status = 'sending',
      email_attempts = email_attempts + 1,
      email_started_at = pg_catalog.now(),
      last_email_error = NULL
  WHERE id = p_receipt_id
    AND email_attempts < 5
    AND (
      email_status IN ('pending', 'failed')
      OR (email_status = 'sending' AND email_started_at < pg_catalog.now() - interval '10 minutes')
    )
  RETURNING id INTO v_claimed;

  RETURN v_claimed IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_booking_receipt_email(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_booking_receipt_email(uuid) TO service_role;
