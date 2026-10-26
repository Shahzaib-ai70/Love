# VPS Deployment

This project is already suitable for VPS deployment as a static website. No app behavior changes are required.

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

## 4. Publish Build Files

For the existing `testingpro.site` VPS, the active Nginx configuration uses
`/var/www/testingpro.site/app` as its web root. Copying files to
`/var/www/love-memories` will not update that site.

```bash
sudo mkdir -p /var/www/testingpro.site/app
sudo cp -a dist/. /var/www/testingpro.site/app/
```

## 5. Configure Nginx

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

## 6. Enable HTTPS

If your domain already points to the VPS:

```bash
sudo apt update
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

## 7. Important Note About Routing

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

## 8. Update Website Later

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
