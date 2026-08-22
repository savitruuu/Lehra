# Lehra as a MERN app

The app is a React frontend (`client/`) and an Express + MongoDB API
(`server/`). The original single-page version has been fully replaced and
moved to `Non-MERN/` for reference; it is not built or deployed anymore.

## What the server is for, and what it is not for

The API exists to answer one question: **who uses this app**. It holds accounts
and, later, billing. That is the whole scope.

Practice logs and player settings stay in the browser's `localStorage`, exactly
as they always have — under `lehra_practice_logs` and `lehra_user_settings`.
There is no route that accepts them, and `client/src/lib/practiceLog.js` and
`client/src/lib/settings.js` contain no `fetch`. Signing in does not move that
data anywhere.

Accounts are **optional**. The player, the practice log, the analytics and every
setting work signed out and with the API switched off entirely. Nothing is
gated on a user.

## Running it

Two processes in development.

### 1. The API

```
cd server
cp .env.example .env          # then fill in MONGODB_URI and JWT_SECRET
npm install
npm run dev                   # http://localhost:4000
```

`MONGODB_URI` can be a local `mongod` or an Atlas connection string. Generate
`JWT_SECRET` with:

```
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

The server exits with a clear message if Mongo is unreachable.

### 2. The client

```
cd client
npm install
npm run dev                   # http://localhost:5173
```

Vite proxies `/api` to `http://localhost:4000`, so the session cookie is a plain
same-origin `httpOnly` cookie rather than a cross-origin one. The client runs
fine on its own if the API is not up — you just cannot sign in.

Production build: `npm run build`, output in `client/dist/`.

## The auth API

| Route | Purpose |
|---|---|
| `POST /api/auth/signup` | `{ email, password, name }` → creates the user, sets the session cookie |
| `POST /api/auth/login` | `{ email, password }` → sets the session cookie |
| `POST /api/auth/logout` | clears it |
| `GET /api/auth/me` | `{ user }` or `{ user: null }` — 200 either way, since signed out is a normal state |

Passwords are bcrypt-hashed (12 rounds) and never returned. Signup and login are
rate-limited to 20 attempts per 15 minutes. Login answers the same way for an
unknown email and a wrong password, so the response cannot be used to discover
which emails are registered.

**There is no login UI yet.** `client/src/auth/AuthContext.jsx` is wired and
calls `/api/auth/me` on load, but no screen uses it and Settings shows no
account section — by request. Building the screens is a matter of consuming
`useAuth()`; nothing else has to change.

## Payments

Not wired up. `User.billing` has `customerId` (null) and `plan` ("free") so that
adding a gateway later is a route and a webhook rather than a migration. Which
provider decides only what goes in `customerId`.

## How the frontend is laid out

```
client/src/
  engine/       the audio engine, unchanged in substance — now ES modules
  lib/          localStorage, options, and the one file that calls the API
  player/       PlayerContext: the bridge between React state and the engine
  ui/           drawer / sheet / picker state, and their shared history entry
  components/   shared pieces (tiles, sliders, the avartan ring, navigation)
  screens/      the four screens
  style.css     unchanged from the original
```

Two notes on the port:

- **The audio engine was not rewritten.** It owns an `AudioContext`, a lookahead
  scheduler and live audio nodes, none of which survive a re-render. It stays an
  imperative singleton; `PlayerContext` mirrors it into React state, pushes
  changes down through effects, and takes the beat callback back up.

- **The desktop layout is gone, because it already was.** The original shipped
  two layouts and moved DOM nodes between them at a media query of
  `max-width: 99999px` — which always matches. Only the phone layout ever
  rendered, so the port renders it directly and the relocation machinery
  (`registerRelocation`, `applyLayoutRelocations`) is not carried over.
