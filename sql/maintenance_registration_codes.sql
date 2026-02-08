-- PostgreSQL function to perform registration code maintenance atomically
-- This function expires old codes and deletes very old expired codes in a single transaction
--
-- DEPLOYMENT STATUS: ✅ Applied to Supabase database
-- CREATED: 2026-02-08
-- USAGE: Called via supabase.rpc('maintenance_registration_codes', { p_current_time, p_cleanup_threshold })

CREATE OR REPLACE FUNCTION maintenance_registration_codes(
    p_current_time TIMESTAMPTZ,
    p_cleanup_threshold TIMESTAMPTZ
) 
RETURNS JSON AS $$
DECLARE
    expired_count INT := 0;
    deleted_count INT := 0;
    expired_codes_result INT;
    deleted_codes_result INT;
BEGIN
    -- Start transaction (function runs in transaction by default)
    
    -- 1. Mark registration codes as expired where:
    --    - expires_at is less than p_current_time
    --    - status is not 'used' (to preserve audit trail for used codes)
    --    - status is not already 'expired' (to avoid unnecessary updates)
    WITH expired_update AS (
        UPDATE "RegistrationCode" 
        SET status = 'expired'
        WHERE expires_at < p_current_time 
        AND status NOT IN ('used', 'expired')
        RETURNING code_id
    )
    SELECT COUNT(*) INTO expired_codes_result FROM expired_update;
    
    -- Set the expired count
    expired_count := COALESCE(expired_codes_result, 0);
    
    -- 2. Delete very old registration codes where:
    --    - created_at is less than or equal to p_cleanup_threshold (30+ days old)
    --    - status is 'expired' (preserve used codes for audit purposes)
    WITH deleted_codes AS (
        DELETE FROM "RegistrationCode"
        WHERE created_at <= p_cleanup_threshold 
        AND status = 'expired'
        RETURNING code_id
    )
    SELECT COUNT(*) INTO deleted_codes_result FROM deleted_codes;
    
    -- Set the deleted count
    deleted_count := COALESCE(deleted_codes_result, 0);
    
    -- Return the results as JSON
    RETURN json_build_object(
        'expired_count', expired_count,
        'deleted_count', deleted_count
    );
    
EXCEPTION
    WHEN OTHERS THEN
        -- Log error and re-raise to rollback transaction
        RAISE EXCEPTION 'Maintenance operation failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions (adjust based on your database user)
-- GRANT EXECUTE ON FUNCTION maintenance_registration_codes(TIMESTAMPTZ, TIMESTAMPTZ) TO your_app_user;