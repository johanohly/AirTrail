ALTER TABLE app_config
    ADD COLUMN config JSONB NOT NULL DEFAULT '{}';

WITH first_row AS (SELECT id
                   FROM app_config
                   ORDER BY id ASC
                   LIMIT 1)
UPDATE app_config
SET config = JSONB_BUILD_OBJECT(
        'oauth', JSONB_BUILD_OBJECT(
                'enabled', enabled,
                'issuerUrl', issuer_url,
                'clientId', client_id,
                'clientSecret', client_secret,
                'scope', scope,
                'autoRegister', auto_register,
                'autoLogin', auto_login
                 )
             )
WHERE id in (SELECT id FROM first_row);

ALTER TABLE app_config
    DROP COLUMN enabled,
    DROP COLUMN issuer_url,
    DROP COLUMN client_id,
    DROP COLUMN client_secret,
    DROP COLUMN scope,
    DROP COLUMN auto_register,
    DROP COLUMN auto_login;