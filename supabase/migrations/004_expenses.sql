CREATE TABLE expenses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  user_id     UUID NOT NULL REFERENCES users(id),
  amount      NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  category    TEXT NOT NULL,
  description TEXT,
  expense_date DATE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Landlord can CRUD their own expenses
CREATE POLICY "owner_all" ON expenses FOR ALL
  USING (user_id = auth.uid());

CREATE INDEX ON expenses(property_id);
CREATE INDEX ON expenses(user_id);
