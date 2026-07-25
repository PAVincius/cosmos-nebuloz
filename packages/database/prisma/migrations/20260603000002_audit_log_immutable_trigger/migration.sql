-- Make AuditLog append-only: block UPDATE and DELETE at the database level
CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only. Mutations are not permitted. Use soft-delete patterns instead.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_immutable
  BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();
