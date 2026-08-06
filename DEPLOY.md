# Deploying Lehra

The app is static — eight source files and a directory of mp3s. The container is
nginx serving them; there is no server-side code, no database and no state, so
the container is disposable and can scale to zero between sessions.

Image size is roughly 60 MB: about 54 MB of that is `nginx:1.27-alpine` and
6.8 MB is the app, nearly all of it audio.

## Prerequisites

Neither of these is currently installed on this machine.

- **Docker Desktop** — https://docs.docker.com/desktop/install/windows-install/
- A CLI for whichever host you pick, below.

## Build and run locally

```sh
docker compose up --build
```

Then open http://localhost:8080. To check the container without a browser:

```sh
curl -i http://localhost:8080/healthz          # expect 200 ok
curl -sI http://localhost:8080/ | grep -i cache-control       # expect no-cache
curl -sI http://localhost:8080/audio/tanpura-pa-233.mp3 | grep -i -e cache-control -e accept-ranges
#   expect: immutable, and accept-ranges: bytes
```

That last one matters. The tanpura samples are ~1 MB each and the player seeks
within them; without `accept-ranges: bytes` every seek refetches the whole file.

Without compose:

```sh
docker build -t lehra:local .
docker run --rm -p 8080:8080 lehra:local
```

## Deploy

All three of these terminate TLS for you and inject the port the container
should listen on, which is why the nginx config templates `${PORT}` rather than
hardcoding 80.

### Google Cloud Run — recommended for this app

Scales to zero, so an app used for an hour a day costs approximately nothing,
and it gives you an HTTPS URL with no certificate work.

```sh
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud run deploy lehra \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated \
  --memory 256Mi \
  --cpu 1
```

`--source .` builds the image with Cloud Build and skips the registry push
entirely. `asia-south1` is Mumbai; use whatever region you are nearest.

### Fly.io

Also scales to zero, and has a Mumbai region.

```sh
fly launch --no-deploy      # generates fly.toml; set internal_port = 8080
fly deploy
```

### Azure Container Apps

```sh
az containerapp up \
  --name lehra \
  --resource-group lehra-rg \
  --location centralindia \
  --source . \
  --ingress external \
  --target-port 8080
```

## Two things worth doing before this is public

1. **Bundle the fonts.** `style.css` imports Cormorant Garamond and Inter from
   `fonts.googleapis.com`. Hosted, that works but adds a third-party request on
   every cold load and sends your visitors' IPs to Google. Self-hosting the two
   families is about 200 KB and removes the dependency — and it becomes
   *required*, not optional, if you ever package the app for offline use, since
   a CDN import is the one thing that cannot work without a network.

2. **Decide on caching if you stop bumping `?v=`.** The one-day TTL on JS and
   CSS assumes the `?v=` stamps in `index.html` keep moving. They are at
   `v=13.0` today. If a deploy ever ships without bumping them, browsers will
   hold the old files for up to a day.

## Then, if you still want an APK

Hosting is what unblocks it. Once this has a public HTTPS URL, the shortest path
to an installable Android package is:

1. Add a web app manifest and a service worker, making it a PWA.
2. Run it through [PWABuilder](https://www.pwabuilder.com/) or
   [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap), which wrap a
   hosted PWA in a Trusted Web Activity and emit a signed APK/AAB.

That route needs no Android SDK and no JDK locally — the wrapping happens
against the URL. The alternative, Capacitor, bundles the web assets into the APK
itself and works offline without hosting, but needs a JDK 17+ and the Android
SDK on this machine.
