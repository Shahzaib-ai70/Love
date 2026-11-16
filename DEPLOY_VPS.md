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

## 4. Configure The SQL API And Separate Admin Login

The admin login is separate from all memory accounts. Generate its configuration on the
VPS; the password prompt is hidden and the script prints only a bcrypt hash:

```bash
cd /var/www/love-memories-source
npm ci
npm run admin:hash
```

The script uses `SHAHZAIBKS` as the admin username and prompts for a separate password
without displaying it. Copy the two printed `ADMIN_...` lines into the API environment file:

```bash
sudo mkdir -p /var/lib/love-memories
sudo chown www-data:www-data /var/lib/love-memories
sudoedit /etc/love-memories-api.env
```

Set these values and paste in the generated username and hash:

```text
NODE_ENV=production
PORT=3001
DB_PATH=/var/lib/love-memories/love-memories.sqlite
ADMIN_USERNAME=SHAHZAIBKS
ADMIN_PASSWORD_HASH=<paste-the-generated-bcrypt-hash>
```

Install and start the service (the service file expects the source at
`/var/www/love-memories-source`):

```bash
sudo cp deploy/love-memories-api.service /etc/systemd/system/love-memories-api.service
sudo systemctl daemon-reload
sudo systemctl enable --now love-memories-api
sudo systemctl status love-memories-api
```

Keep `/var/lib/love-memories` persistent when updating the website. The API applies
database schema updates when it starts. Restart the service after changing its
environment file:

```bash
sudo systemctl restart love-memories-api
```

To replace a forgotten admin password without manually copying a hash or editing the
environment file, pull the latest code and run this command as root on the VPS:

```bash
cd /var/www/love-memories-source
sudo npm run admin:reset
```

It securely prompts for and confirms a new password, updates only the admin settings in
`/etc/love-memories-api.env`, and restarts the API service. The username remains
`SHAHZAIBKS`; admin credentials remain separate from memory account credentials.

If a memory account password no longer works, reset that account without deleting its
memories by running this command as root on the VPS:

```bash
cd /var/www/love-memories-source
sudo npm run memory:reset-password
```

Enter the memory account's username and choose a new password at the hidden prompts.
The script stops the API while updating that account's password, revokes its old
sessions, preserves its memories, and starts the API again.

## 5. Publish Build Files

For the existing `testingpro.site` VPS, the active Nginx configuration uses
`/var/www/testingpro.site/app` as its web root. Copying files to
`/var/www/love-memories` will not update that site.

```bash
sudo mkdir -p /var/www/testingpro.site/app
sudo cp -a dist/. /var/www/testingpro.site/app/
```

## 6. Configure Nginx

- The `/api/` proxy must be in the active HTTPS (`listen 443`) server block for
  `testingpro.site`, not only the HTTP redirect block. Locate the active config:

  ```bash
  sudo nginx -T 2>/dev/null | grep -nE 'configuration file|listen 443|server_name testingpro.site|location /api/'
  ```

- Edit the active Nginx config file shown in the output and add this location inside
  the HTTPS server block for `testingpro.site`:

  ```nginx
  location /api/ {
    client_max_body_size 32m;
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
  ```

- Keep the existing HTTPS site configuration; do not replace it with the example config.
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
