DO $$
DECLARE
    owner_exists BOOLEAN;
    user_id_to_update TEXT;
BEGIN
    SELECT EXISTS(SELECT 1 FROM "user" WHERE role = 'owner') INTO owner_exists;

    IF NOT owner_exists THEN
        SELECT id INTO user_id_to_update FROM "user" WHERE role = 'admin' LIMIT 1;

        UPDATE "user" SET role = 'owner' WHERE id = user_id_to_update;
    END IF;
END $$;