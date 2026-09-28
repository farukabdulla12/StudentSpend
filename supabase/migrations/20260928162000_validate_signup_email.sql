CREATE OR REPLACE FUNCTION public.validate_signup_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    normalized_email text;
    email_domain text;
    blocked_domain text;
    disposable_domains constant text[] := ARRAY[
        '10minutemail.com',
        '10minutemail.co.uk',
        '10minutemail.net',
        'dispostable.com',
        'emailondeck.com',
        'fakeinbox.com',
        'getnada.com',
        'guerrillamail.com',
        'guerrillamailblock.com',
        'guerrillamail.net',
        'maildrop.cc',
        'mailinator.com',
        'mailinator.net',
        'mailinator.org',
        'mohmal.com',
        'sharklasers.com',
        'temp-mail.io',
        'temp-mail.org',
        'tempmail.com',
        'tempmail.net',
        'throwaway.email',
        'throwawaymail.com',
        'trashmail.com',
        'yopmail.com',
        'yopmail.fr',
        'yopmail.net'
    ];
BEGIN
    normalized_email := pg_catalog.lower(NEW.email);

    IF normalized_email IS NULL
       OR pg_catalog.length(normalized_email) > 254
       OR normalized_email !~* $email$^[A-Z0-9!#$%&'*+/=?^_`{|}~-]+(\.[A-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@[A-Z0-9]([A-Z0-9-]{0,61}[A-Z0-9])?(\.[A-Z0-9]([A-Z0-9-]{0,61}[A-Z0-9])?)+$email$
       OR pg_catalog.length(pg_catalog.split_part(normalized_email, '@', 1)) > 64
       OR pg_catalog.split_part(normalized_email, '@', 2) !~* $domain$^[A-Z0-9-]+(\.[A-Z0-9-]+)*\.[A-Z]{2,}$domain$
    THEN
        RAISE EXCEPTION 'Invalid email format. Please enter a valid email address.';
    END IF;

    email_domain := pg_catalog.split_part(normalized_email, '@', 2);

    FOREACH blocked_domain IN ARRAY disposable_domains
    LOOP
        IF email_domain = blocked_domain
           OR pg_catalog.right(
               email_domain,
               pg_catalog.length(blocked_domain) + 1
           ) = '.' || blocked_domain
        THEN
            RAISE EXCEPTION 'Temporary/disposable email addresses are not allowed.';
        END IF;
    END LOOP;

    RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.validate_signup_email() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_signup_email() FROM anon, authenticated;

DROP TRIGGER IF EXISTS validate_signup_email_before_insert ON auth.users;

CREATE TRIGGER validate_signup_email_before_insert
    BEFORE INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_signup_email();
