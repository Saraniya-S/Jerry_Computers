# Hosting on a Hostinger VPS

How the site runs on the server:

- **PostgreSQL 17** in Docker, reachable only from the server itself (`deploy/docker-compose.yml`).
- **The website** (Next.js on Node.js 24), built on the server and kept running by systemd (`deploy/jerry-computers.service`).
- **Caddy** in front, serving `https://` with free certificates it renews itself (`deploy/Caddyfile`).
- **Nightly backups** of the database and uploaded photos (`deploy/backup.sh`).

The site has to be built on the server, after the database is running: the home page is prerendered
from the database, so `npm run build` fails without it.

Commands in grey boxes are typed on the server after connecting with SSH, unless a step says otherwise.

---

## 1. Buy and set up the VPS

1. In Hostinger, choose a **KVM VPS**. **KVM 1** (1 vCPU, 4 GB RAM) is enough to start; KVM 2 builds faster.
2. Operating system: **Ubuntu 24.04** (plain OS, no control panel).
3. Set a strong **root password**, and add your SSH key if you have one.
4. Note the server's **IP address** from hPanel → VPS → Overview.

## 2. Point your domain at the server

In hPanel → **Domains → DNS / Nameservers** (or wherever your domain's DNS is managed), add:

| Type | Name | Points to | TTL |
|------|------|-----------|-----|
| A | `@` | your VPS IP | 300 |
| A | `www` | your VPS IP | 300 |

Remove any older `A` or `AAAA` records for `@` and `www` that point elsewhere. DNS can take
anywhere from a few minutes to a few hours; check with `ping yourdomain.com` from your computer.

## 3. Connect and run the base setup

From your computer:

```bash
ssh root@YOUR_VPS_IP
```

Then on the server, fetch and run the setup script (replace the domain):

```bash
curl -fsSLO https://raw.githubusercontent.com/Saraniya-S/Jerry_Computers/main/deploy/setup-server.sh
bash setup-server.sh yourdomain.com
```

If the repository is private, that download fails: copy `deploy/setup-server.sh` from your
computer instead with `scp deploy/setup-server.sh root@YOUR_VPS_IP:` and run the second line.

This installs Docker, Node.js 24, Caddy, a firewall (SSH, HTTP and HTTPS only), 2 GB of swap, and
creates the `jerry` user that runs the site.

## 4. Get the code onto the server

Switch to the `jerry` user and create a read-only key for GitHub:

```bash
su - jerry
ssh-keygen -t ed25519 -C "jerry-vps" -N "" -f ~/.ssh/id_ed25519
cat ~/.ssh/id_ed25519.pub
```

On GitHub: the repository → **Settings → Deploy keys → Add deploy key**, paste the key, leave
"Allow write access" off. Then back on the server:

```bash
git clone git@github.com:Saraniya-S/Jerry_Computers.git ~/app
exit
```

Now, as root again, run the setup script a second time. With the code in place it installs the
service, the Caddy config for your domain and the nightly backup:

```bash
bash setup-server.sh yourdomain.com
```

## 5. Production settings

```bash
su - jerry
cd ~/app
cp deploy/env.production.example .env.local
nano .env.local
```

Fill in every value (save with Ctrl+O, Enter, Ctrl+X):

- **POSTGRES_PASSWORD / DATABASE_URL** – make up a long random password and use it in both.
- **AUTH_SECRET** – run `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` and paste the result.
- **APP_URL** – `https://yourdomain.com`.
- **SMTP_*** – a real mail account. For Gmail, `SMTP_PASSWORD` is a Google **App password**
  (Google Account → Security → 2-Step Verification → App passwords), not your normal password.
- **GOOGLE_CLIENT_ID / SECRET** – the same OAuth client as now; see step 8 for the new redirect URI.
- **RAZORPAY_*** – test keys until your Razorpay account is activated, then the `rzp_live_…` keys.

Then lock the file so only `jerry` can read it:

```bash
chmod 600 .env.local
```

## 6. Start the database, build and launch

Still as `jerry` in `~/app`:

```bash
docker compose -f deploy/docker-compose.yml --env-file .env.local up -d
npm ci
npm run db:migrate
NODE_ENV=production npm run build
sudo systemctl restart jerry-computers
```

The build takes a few minutes. Then create the owner's admin account (you'll type the password; it
isn't shown):

```bash
npm run admin:create
```

Open `https://yourdomain.com`. The first visit can take a few seconds while Caddy fetches the
certificate.

## 7. In the admin area

Sign in as the admin and, under **Admin → Settings**:

- Check the shop details, GSTIN and invoice terms.
- **On-site visit area**: set the shop's exact map pin (long-press the shop in Google Maps and copy
  the numbers) and the distance outside Kanniyakumari district.
- Delivery charge and cash on delivery.

Then add products, engineers and staff as usual.

## 8. Point outside services at the new address

- **Google sign-in**: Google Cloud Console → APIs & Services → Credentials → your OAuth client →
  add `https://yourdomain.com/api/auth/google/callback` to **Authorised redirect URIs**, and
  `https://yourdomain.com` to **Authorised JavaScript origins**. If the app is still in "Testing"
  mode, publish it (OAuth consent screen) so any customer can sign in.
- **Razorpay**: Dashboard → **Webhooks → Add new webhook**: URL
  `https://yourdomain.com/api/payments/razorpay/webhook`, a secret of your choice (the same as
  `RAZORPAY_WEBHOOK_SECRET`), and the events `payment.captured`, `payment.failed`, `order.paid`,
  `refund.processed`, `refund.failed`. Also add your domain under **Account & Settings → Website
  and app details**.

---

## Alternative: everything in Docker

Instead of steps 3–6 (Node.js and Caddy installed on the server), the database, the site and Caddy
can all run as containers from `deploy/docker-compose.yml`. Only Docker and git are needed on the
server, and uploaded photos and the database live on Docker volumes.

1. Install Docker: `curl -fsSL https://get.docker.com | sh`, and allow SSH, HTTP and HTTPS:
   `ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable`.
2. Clone the code to `/opt/jerry-computers` (deploy key as in step 4).
3. `cp deploy/env.production.example .env.local`, fill it in (step 5), and set `SITE_ADDRESS` to your
   domain(s), e.g. `"yourdomain.com, www.yourdomain.com"`, or `:80` to use the IP address until DNS is
   ready. Then `chmod 600 .env.local`.
4. `./deploy/docker-update.sh --no-pull` – starts the database, runs migrations, builds the site and
   starts it with Caddy. Later updates: `./deploy/docker-update.sh`.
5. Create the admin account:
   `docker compose -f deploy/docker-compose.yml --env-file .env.local run --rm --entrypoint node app scripts/create-super-admin.mjs`

Logs: `docker compose -f deploy/docker-compose.yml --env-file .env.local logs -f app`. Back up the
database with `pg_dump` through the `postgres` service, as in `deploy/backup.sh`.

---

## Updating the site

After pushing new code to GitHub:

```bash
ssh root@YOUR_VPS_IP
su - jerry
cd ~/app && ./deploy/update.sh
```

It pulls the code, installs packages, runs any new database migrations, builds and restarts. The
site is unavailable for the few seconds of the restart.

## Day to day

| Task | Command (as `jerry`, in `~/app`) |
|------|------------------------------|
| Is the site running? | `systemctl status jerry-computers` |
| Live logs | `journalctl -u jerry-computers -f` |
| Restart | `sudo systemctl restart jerry-computers` |
| Database running? | `docker compose -f deploy/docker-compose.yml ps` |
| Back up now | `./deploy/backup.sh` |

Backups are written to `/home/jerry/backups` every night at 02:30 and kept for 14 days. Copy them
off the server now and then (for example with `scp`), or enable Hostinger's weekly VPS backups in
hPanel as well.

**Restoring the database** from a backup:

```bash
docker compose -f deploy/docker-compose.yml --env-file .env.local exec -T postgres \
  pg_restore -U jerry -d jerry_computers --clean --if-exists < ~/backups/db-YYYY-MM-DD.dump
```

## If something goes wrong

- **The site shows "502 Bad Gateway"**: the app isn't running. Check
  `journalctl -u jerry-computers -n 50` for the error; most often a missing value in `.env.local`.
- **No HTTPS / certificate errors**: the domain doesn't point at the server yet (step 2), or ports
  80/443 are blocked. Check `journalctl -u caddy -n 50`.
- **The build fails with `ECONNREFUSED`**: the database isn't running. Start it (step 6, first line).
- **Emails don't arrive**: check the `SMTP_*` values; Gmail needs an App password.
- **Google sign-in fails with `redirect_uri_mismatch`**: the redirect URI in step 8 doesn't match
  `APP_URL` exactly.
