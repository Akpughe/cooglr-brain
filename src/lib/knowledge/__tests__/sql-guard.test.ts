import { describe, it, expect } from "vitest";
import { guardReadOnlySql, GuardError } from "../sql-guard";

describe("guardReadOnlySql", () => {
  it("allows a simple SELECT and injects a LIMIT", () => {
    const out = guardReadOnlySql("SELECT id FROM users", { maxRows: 1000 });
    expect(out.toLowerCase()).toContain("select id from users");
    expect(out.toLowerCase()).toContain("limit 1000");
  });

  it("allows a CTE (WITH ... SELECT)", () => {
    const out = guardReadOnlySql("WITH x AS (SELECT 1 a) SELECT a FROM x", {
      maxRows: 10,
    });
    expect(out.toLowerCase()).toContain("with x as");
  });

  it("preserves an existing LIMIT under the cap", () => {
    const out = guardReadOnlySql("SELECT 1 LIMIT 5", { maxRows: 1000 });
    expect(out.toLowerCase()).toContain("limit 5");
    expect(out.toLowerCase()).not.toContain("_guarded");
  });

  it("re-caps a LIMIT above the cap", () => {
    const out = guardReadOnlySql("SELECT 1 LIMIT 99999", { maxRows: 1000 });
    expect(out.toLowerCase()).toContain("limit 1000");
    expect(out.toLowerCase()).toContain("_guarded");
  });

  it("rejects INSERT", () => {
    expect(() => guardReadOnlySql("INSERT INTO users VALUES (1)", { maxRows: 10 })).toThrow(GuardError);
  });
  it("rejects UPDATE", () => {
    expect(() => guardReadOnlySql("UPDATE users SET x=1", { maxRows: 10 })).toThrow(GuardError);
  });
  it("rejects DELETE", () => {
    expect(() => guardReadOnlySql("DELETE FROM users", { maxRows: 10 })).toThrow(GuardError);
  });
  it("rejects DROP / DDL", () => {
    expect(() => guardReadOnlySql("DROP TABLE users", { maxRows: 10 })).toThrow(GuardError);
  });
  it("rejects multiple statements", () => {
    expect(() => guardReadOnlySql("SELECT 1; DELETE FROM users", { maxRows: 10 })).toThrow(GuardError);
  });
  it("rejects a trailing-comment write smuggle", () => {
    expect(() => guardReadOnlySql("SELECT 1; -- ok\nDROP TABLE users", { maxRows: 10 })).toThrow(GuardError);
  });
  it("rejects writes hidden after a block comment", () => {
    expect(() => guardReadOnlySql("/* note */ UPDATE users SET x=1", { maxRows: 10 })).toThrow(GuardError);
  });
  it("rejects an empty statement", () => {
    expect(() => guardReadOnlySql("   ", { maxRows: 10 })).toThrow(GuardError);
  });
  it("rejects SELECT INTO (DDL write disguised as a SELECT)", () => {
    expect(() => guardReadOnlySql("SELECT * INTO exfil FROM users", { maxRows: 10 })).toThrow(GuardError);
  });
  it("rejects pg_read_file (server filesystem read)", () => {
    expect(() => guardReadOnlySql("SELECT pg_read_file('/etc/passwd')", { maxRows: 10 })).toThrow(GuardError);
  });
  it("rejects dblink (reach another system)", () => {
    expect(() => guardReadOnlySql("SELECT * FROM dblink('host=x','SELECT 1') AS t(a int)", { maxRows: 10 })).toThrow(GuardError);
  });
});
