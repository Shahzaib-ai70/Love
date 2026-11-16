# VPS Deployment

The website is served as static files, while accounts, memories, partner invitations,
and chat messages require the SQL API service to remain running with persistent storage.

## 1. Server Requirements

- Ubuntu/Debian VPS
- Nginx
- Node.js 18 or newer
- A domain pointed to your VPS IP

## 2. Upload Project

Copy the project to your VPS, for example:

```bash
scp -r Love user@your-vps-ip:/var/www/love-memories-source
```

Or clone it with Git on the VPS.

## 3. Install And Build

```bash
cd /var/www/love-memories-source
npm install
npm run build
```

This creates the production files inside `dist/`.

## 4. Configure The SQL API

The API service needs a persistent database directory and the UUID of the account that
should administer the site. If you have not created an account yet, initially leave
`ADMIN_USER_ID` blank and start the service. After publishing the site and configuring
the Nginx `/api/` proxy below, create an account from the Memories page, find its UUID in
the database's `users` table with a SQLite viewer, then add it to the environment file.
Passwords are hashed and cannot be used to identify the account.

```bash
sudo mkdir -p /var/lib/love-memories
sudo chown www-data:www-data /var/lib/love-memories
sudoedit /etc/love-memories-api.env
```

Set the environment file values:

```text
NODE_ENV=production
PORT=3001
DB_PATH=/var/lib/love-memories/love-memories.sqlite
ADMIN_USER_ID=
```

For an existing account, set the value to its UUID instead of leaving it blank.

Install and start the service (the service file expects the source at
`/var/www/love-memories-source`):

```bash
sudo cp deploy/love-memories-api.service /etc/systemd/system/love-memories-api.service
sudo systemctl daemon-reload
sudo systemctl enable --now love-memories-api
sudo systemctl status love-memories-api
```

Keep `/var/lib/love-memories` persistent when updating the website. The API applies
database schema updates when it starts. The admin panel stays disabled until a valid
`ADMIN_USER_ID` is set. Restart the service after changing its environment file:

```bash
sudo systemctl restart love-memories-api
```

## 5. Publish Build Files

For the existing `testingpro.site` VPS, the active Nginx configuration uses
`/var/www/testingpro.site/app` as its web root. Copying files to
`/var/www/love-memories` will not update that site.

```bash
sudo mkdir -p /var/www/testingpro.site/app
sudo cp -a dist/. /var/www/testingpro.site/app/
```

## 6. Configure Nginx

- Open `deploy/nginx-love-memories.conf`
- Replace `yourdomain.com` with your real domain
- For a new site, configure `root` to match the directory where you publish the
  contents of `dist/`.
- For the existing `testingpro.site` VPS, keep its configured root at
  `/var/www/testingpro.site/app`; do not replace its active site configuration
  with the example config.

```nginx
root /var/www/testingpro.site/app;
```

For a new site only, install and enable the Nginx config:

```bash
sudo cp deploy/nginx-love-memories.conf /etc/nginx/sites-available/love-memories
sudo ln -s /etc/nginx/sites-available/love-memories /etc/nginx/sites-enabled/love-memories
sudo nginx -t
sudo systemctl reload nginx
```

## 7. Enable HTTPS

If your domain already points to the VPS:

```bash
sudo apt update
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

## 8. Important Note About Routing

This site uses React Router with routes like:

- `/`
- `/home`
- `/memories`
- `/messages`
- `/heart-maker`

Because of that, the Nginx config must include:

```nginx
try_files $uri $uri/ /index.html;
```

That line is already included in `deploy/nginx-love-memories.conf`.

## 9. Update Website Later

Whenever you change the website:

```bash
cd /var/www/love-memories-source
git pull --ff-only origin main
npm ci
npm run build
sudo mkdir -p /var/www/testingpro.site/app
sudo cp -a dist/. /var/www/testingpro.site/app/
sudo nginx -t && sudo systemctl reload nginx
```

Confirm that Nginx serves the build you just copied:

```bash
grep -oE 'assets/[^"]+' dist/index.html
grep -oE 'assets/[^"]+' /var/www/testingpro.site/app/index.html
curl -fsS https://testingpro.site/ | grep -oE 'assets/[^"]+'
```

The three commands should show the same JavaScript and CSS asset names. If they
differ, inspect the active Nginx configuration and make sure its `root` for
`testingpro.site` is `/var/www/testingpro.site/app`:

```bash
sudo nginx -T 2>/dev/null | grep -nE 'server_name|root '
```
