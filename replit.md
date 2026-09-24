# Tyler Johnson about-me website

## Run

The project uses Node.js built-ins only, so no package installation is required. Start it with:

```bash
npm run dev
```

The Replit workflow serves the site on port 5000.

## Project structure

- `index.html` — home page
- `media.html` — placeholder media gallery
- `future.html` — future goals and ideas page
- `choice-one.html` — Projects page with the Bubble Collector game
- `choice-two.html` — contact page with form
- `admin.html` — password-protected message dashboard
- `admin-login.html`, `admin-login.js`, and `admin-auth.js` — admin sign-in and sign-out
- `styles.css` — shared responsive styling and the cream/lilac theme
- `script.js` — navigation, reveal animations, form submission, and dashboard loading
- `bubble-game.js` — Bubble Collector gameplay, upgrades, and saved progress
- `server.js` — static file server plus `/api/messages` GET/POST routes
- `data/messages.json` — persistent local message storage

The site intentionally uses placeholder copy and visual placeholders wherever Tyler's personal writing, images, goals, social links, or accomplishments are still missing.

## Admin access

The admin dashboard and message-list API require a signed, HTTP-only session cookie. Set `ADMIN_PASSWORD` in Replit Secrets; `SESSION_SECRET` is also required to sign sessions. The raw admin password must not be committed to the project.