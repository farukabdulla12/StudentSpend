ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS income_source text,
    ADD COLUMN IF NOT EXISTS income_source_name text;

ALTER TABLE public.transactions
    DROP CONSTRAINT IF EXISTS transactions_savings_source_check;

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
                    AND savings_platform IN (
                        'google_pay',
                        'phonepe',
                        'bank_account',
                        'other'
                    )
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

DO $migration$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'transactions_income_source_check'
          AND conrelid = 'public.transactions'::regclass
    ) THEN
        ALTER TABLE public.transactions
            ADD CONSTRAINT transactions_income_source_check
            CHECK (
                (
                    income_source IS NULL
                    AND income_source_name IS NULL
                )
                OR (
                    type = 'income'
                    AND money_source = 'online'
                    AND (
                        (
                            count_as_savings
                            AND income_source IN (
                                'gpay',
                                'phonepe',
                                'bank_account',
                                'mutual_fund',
                                'other'
                            )
                        )
                        OR (
                            NOT count_as_savings
                            AND income_source IN (
                                'gpay',
                                'phonepe',
                                'bank_transfer',
                                'other'
                            )
                        )
                    )
                    AND (
                        (
                            income_source = 'other'
                            AND length(trim(coalesce(income_source_name, ''))) > 0
                        )
                        OR (
                            income_source <> 'other'
                            AND income_source_name IS NULL
                        )
                    )
                )
            );
    END IF;
END;
$migration$;
