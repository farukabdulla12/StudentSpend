ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS savings_bucket text,
    ADD COLUMN IF NOT EXISTS savings_platform text,
    ADD COLUMN IF NOT EXISTS savings_platform_name text;

DO $migration$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'transactions_savings_source_check'
          AND conrelid = 'public.transactions'::regclass
    ) THEN
        ALTER TABLE public.transactions
            ADD CONSTRAINT transactions_savings_source_check
            CHECK (
                (
                    savings_bucket IS NULL
                    AND savings_platform IS NULL
                    AND savings_platform_name IS NULL
                )
                OR (
                    type = 'expense'
                    AND money_source = 'savings'
                    AND savings_bucket IN ('cash', 'online')
                    AND (
                        (
                            savings_bucket = 'cash'
                            AND savings_platform IS NULL
                            AND savings_platform_name IS NULL
                        )
                        OR (
                            savings_bucket = 'online'
                            AND savings_platform IN ('google_pay', 'phonepe', 'other')
                            AND (
                                (
                                    savings_platform = 'other'
                                    AND length(trim(coalesce(savings_platform_name, ''))) > 0
                                )
                                OR (
                                    savings_platform <> 'other'
                                    AND savings_platform_name IS NULL
                                )
                            )
                        )
                    )
                )
            );
    END IF;
END;
$migration$;
