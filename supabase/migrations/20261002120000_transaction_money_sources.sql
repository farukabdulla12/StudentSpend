ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS money_source text;

ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS count_as_savings boolean NOT NULL DEFAULT false;

UPDATE public.transactions
SET money_source = CASE
    WHEN lower(coalesce(payment_method, '')) = 'cash' THEN 'cash'
    ELSE 'online'
END
WHERE money_source IS NULL
   OR money_source NOT IN ('cash', 'online', 'savings');

ALTER TABLE public.transactions
    ALTER COLUMN money_source SET DEFAULT 'online',
    ALTER COLUMN money_source SET NOT NULL;

DO $migration$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'transactions_money_source_check'
          AND conrelid = 'public.transactions'::regclass
    ) THEN
        ALTER TABLE public.transactions
            ADD CONSTRAINT transactions_money_source_check
            CHECK (money_source IN ('cash', 'online', 'savings'));
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'transactions_count_as_savings_income_check'
          AND conrelid = 'public.transactions'::regclass
    ) THEN
        ALTER TABLE public.transactions
            ADD CONSTRAINT transactions_count_as_savings_income_check
            CHECK (NOT count_as_savings OR type = 'income');
    END IF;
END;
$migration$;
