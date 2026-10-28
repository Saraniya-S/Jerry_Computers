// Refuse to run against anything that isn't clearly a test database.
if (!/_test(\?|$)/.test(process.env.DATABASE_URL ?? "")) {
  throw new Error(`Tests must use a database whose name ends in _test (got ${process.env.DATABASE_URL}).`);
}
