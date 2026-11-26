CREATE OR REPLACE FUNCTION public.approve_partner_application(
  p_application_id uuid,
  p_owner_user_id uuid,
  p_admin_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_application record;
    v_user record;
    v_partner record;
    v_email text;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = p_admin_user_id AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Administrator permission is required.';
    END IF;

    SELECT * INTO v_application
    FROM public.partner_applications
    WHERE id = p_application_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Application not found.';
    END IF;

    IF v_application.status <> 'pending' THEN
        RAISE EXCEPTION 'This application has already been reviewed.';
    END IF;

    v_email := lower(trim(v_application.email));
    IF v_email IS NULL OR v_email = '' THEN
        RAISE EXCEPTION 'Application email is missing.';
    END IF;

    PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(v_email, 0)
    );

    SELECT id, email INTO v_user
    FROM auth.users
    WHERE id = p_owner_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Applicant account does not exist.';
    END IF;

    IF lower(trim(v_user.email)) <> v_email THEN
        RAISE EXCEPTION 'Applicant account email does not match the application.';
    END IF;

    IF p_owner_user_id = p_admin_user_id
       OR EXISTS (
           SELECT 1 FROM public.profiles
           WHERE id = p_owner_user_id AND role = 'admin'
       )
    THEN
        RAISE EXCEPTION 'Administrator accounts cannot be registered as partners.';
    END IF;

    IF v_application.applicant_user_id IS NOT NULL
       AND v_application.applicant_user_id <> p_owner_user_id
    THEN
        RAISE EXCEPTION 'Application is already linked to another account.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.property_partners
        WHERE lower(trim(email)) = v_email
           OR owner_user_id = p_owner_user_id
    ) THEN
        RAISE EXCEPTION 'A partner account already exists for this applicant.';
    END IF;

    INSERT INTO public.property_partners (
        owner_user_id, business_name, contact_person, email, phone, status
    )
    VALUES (
        p_owner_user_id,
        v_application.business_name,
        v_application.contact_person,
        v_email,
        v_application.phone,
        'approved'
    )
    RETURNING id, business_name, owner_user_id, status INTO v_partner;

    UPDATE public.partner_applications
    SET status = 'approved',
        applicant_user_id = p_owner_user_id
    WHERE id = p_application_id;

    RETURN jsonb_build_object(
        'success', true,
        'application_id', p_application_id,
        'application_status', 'approved',
        'partner', jsonb_build_object(
            'id', v_partner.id,
            'business_name', v_partner.business_name,
            'owner_user_id', v_partner.owner_user_id,
            'status', v_partner.status
        )
    );
END;
$function$;
