// Creates (or resets the password of) the super admin account.
//   npm run admin:create                -> uses SUPER_ADMIN_EMAIL from .env.local
//   npm run admin:create -- you@x.com   -> another address
// The password is typed here, hidden, and stored only as a scrypt hash.
import { randomBytes, scrypt } from "node:crypto";
import { stdin, stdout } from "node:process";
import postgres from "postgres";

const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function hashPassword(password) {
  const salt = randomBytes(16);
  return new Promise((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, 64, SCRYPT, (err, key) =>
      err ? reject(err) : resolve(["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64url"), key.toString("base64url")].join("$")),
    ),
  );
}

/** Reads a line without echoing it. */
function askHidden(question) {
  return new Promise((resolve) => {
    stdout.write(question);
    let value = "";
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (ch) => {
      if (ch === "\r" || ch === "\n" || ch === "\u0004") {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.off("data", onData);
        stdout.write("\n");
        resolve(value);
      } else if (ch === "\u0003") {
        stdout.write("\n");
        process.exit(130);
      } else if (ch === "\u007f" || ch === "\b") {
        value = value.slice(0, -1);
      } else {
        value += ch;
      }
    };
    stdin.on("data", onData);
  });
}

const args = process.argv.slice(2);
const promote = args.includes("--promote");
const email = (args.find((a) => !a.startsWith("--")) ?? process.env.SUPER_ADMIN_EMAIL ?? "").trim().toLowerCase();
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error("Set SUPER_ADMIN_EMAIL in .env.local or pass an email address.");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing. Run this with npm run admin:create.");
  process.exit(1);
}
if (!stdin.isTTY) {
  console.error("Run this in a terminal so the password can be typed privately.");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
try {
  const [existing] = await sql`select id, role from users where email = ${email}`;
  if (existing?.role === "customer" && !promote) {
    console.error(`${email} is a customer account. Re-run with --promote to turn it into the super admin.`);
    process.exit(1);
  }

  console.log(`${existing ? "Updating" : "Creating"} super admin ${email}`);
  const password = await askHidden("Password (at least 12 characters): ");
  if (password.length < 12) {
    console.error("Use at least 12 characters.");
    process.exit(1);
  }
  if ((await askHidden("Repeat password: ")) !== password) {
    console.error("The passwords don't match.");
    process.exit(1);
  }
  const hash = await hashPassword(password);

  if (existing) {
    await sql`update users set role = 'admin', is_super_admin = true, password_hash = ${hash},
      email_verified_at = coalesce(email_verified_at, now()), failed_logins = 0, locked_until = null, updated_at = now()
      where id = ${existing.id}`;
    // Sign out any old sessions for this account.
    await sql`delete from sessions where user_id = ${existing.id}`;
  } else {
    await sql`insert into users (role, is_super_admin, first_name, last_name, email, password_hash, email_verified_at, onboarded_at)
      values ('admin', true, 'Jerry', 'Admin', ${email}, ${hash}, now(), now())`;
  }
  console.log(`Done. Sign in at /login as ${email}; a one-time code will be emailed to that address.`);
} finally {
  await sql.end();
}
