-- Migration 017: Payment state machine enforcement via BEFORE UPDATE trigger (DATA-03)
-- Valid transitions (per user decision):
--   pending   -> partial, paid, overdue
--   partial   -> paid, overdue
--   overdue   -> partial, paid
--   paid      -> confirmed
--   confirmed -> paid (reversal for landlord correction)
--
-- AUDIT: auto-confirm-payments filters .eq('status', 'paid') -> updates to 'confirmed' (VALID: paid->confirmed)
-- AUDIT: mark-overdue filters .eq('status', 'pending') -> updates to 'overdue' (VALID: pending->overdue)

CREATE OR REPLACE FUNCTION public.validate_payment_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- Same-status update is always allowed (e.g. updating amount_paid without changing status)
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Valid transitions
  IF (OLD.status = 'pending'   AND NEW.status IN ('partial', 'paid', 'overdue')) OR
     (OLD.status = 'partial'   AND NEW.status IN ('paid', 'overdue')) OR
     (OLD.status = 'overdue'   AND NEW.status IN ('partial', 'paid')) OR
     (OLD.status = 'paid'      AND NEW.status = 'confirmed') OR
     (OLD.status = 'confirmed' AND NEW.status = 'paid')
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid payment transition: % → %', OLD.status, NEW.status;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_payment_transition ON public.payments;

CREATE TRIGGER validate_payment_transition
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.validate_payment_transition();
