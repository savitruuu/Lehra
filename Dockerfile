# Lehra, as a container.
#
# Two stages now, where there used to be none. The app was eight source files
# and a directory of mp3s served as they sat on disk, and a bundler would have
# bought nothing; it is a React app since the MERN conversion, so there is a
# real build to run and the result is what nginx serves. The build tooling stays
# in the first stage and never reaches the published image.
#
# What ships is client/dist: the bundled app plus everything under
# client/public, which is where the audio lives.

# ---------------------------------------------------------------- build ---
FROM node:22-alpine AS build

WORKDIR /build

# Manifests first, so a change to application source does not invalidate the
# dependency layer - `npm ci` is the slow step and it only needs these two.
COPY client/package.json client/package-lock.json ./
RUN npm ci

COPY client/ ./
RUN npm run build

# ---------------------------------------------------------------- serve ---
FROM nginx:1.27-alpine

# The config below is a template so that ${PORT} can be filled in at start-up -
# Render, Cloud Run, App Runner and Container Apps all inject the port they want
# the container to listen on rather than letting it choose.
#
# The filter is not optional. nginx's entrypoint runs envsubst over the
# template, and with no filter it substitutes every variable it finds - which
# includes nginx's own $uri, $host and $cache_control, written in the same
# syntax and meant to survive into the final config. Left unfiltered they are
# replaced with empty strings and nginx fails to start. This pins substitution
# to PORT and nothing else.
ENV NGINX_ENVSUBST_FILTER="^PORT$"
ENV PORT=8080

COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template

# The whole build output, rather than files named one at a time the way the
# pre-build image did. The safety that hand-listing bought is now the build's
# job: nothing reaches dist/ that Vite was not asked to emit, so working notes
# and stray logs cannot arrive here by accident.
COPY --from=build /build/dist /usr/share/nginx/html

EXPOSE 8080

# Inherited from the base image, repeated here so it is visible: nginx starts as
# root to bind the port and read the config, then drops its workers to the
# unprivileged `nginx` user.
CMD ["nginx", "-g", "daemon off;"]
