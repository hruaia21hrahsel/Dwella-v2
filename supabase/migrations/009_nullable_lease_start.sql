-- Make lease_start nullable so tenants can be added without a lease start date
ALTER TABLE tenants ALTER COLUMN lease_start DROP NOT NULL;
