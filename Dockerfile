# Lehra, as a container.
#
# There is no build stage because there is nothing to build: the app is eight
# source files and a directory of mp3s, served as they sit on disk. Adding a
# bundler here would buy nothing and cost a toolchain.
FROM nginx:1.27-alpine

# The config below is a template so that ${PORT} can be filled in at start-up -
# Cloud Run, App Runner and Container Apps all inject the port they want the
# container to listen on rather than letting it choose.
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

WORKDIR /usr/share/nginx/html

# Named explicitly rather than `COPY . .`, so that the working notes, the server
# log and anything else that accumulates in the project directory cannot end up
# on a public URL by accident. A new source file has to be added here to ship,
# which is the intended friction.
COPY index.html style.css ./
COPY analytics.js app.js audio.js instruments.js tabla.js taal_data.js ./
COPY tanpura-dsp.js tanpura-worker.js ./
# The app mark. 192 and 512 are not referenced by index.html yet - they are the
# sizes a web app manifest asks for, and are shipped now so that adding one is a
# manifest file and nothing else.
COPY icon.svg icon-32.png icon-180.png icon-192.png icon-512.png ./
COPY audio ./audio

EXPOSE 8080

# Inherited from the base image, repeated here so it is visible: nginx starts as
# root to bind the port and read the config, then drops its workers to the
# unprivileged `nginx` user.
CMD ["nginx", "-g", "daemon off;"]
