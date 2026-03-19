# =============================================================================
# Dart Tracker — Containerfile
# Builds a rootless-Podman-compatible nginx static site image.
#
# Build:
#   podman build -t dart-tracker:latest .
#
# Run (rootless, maps container port 8080 -> host port 80):
#   podman run --rm -p 80:8080 --name dart-tracker dart-tracker:latest
#
# Run (hardened, read-only filesystem):
#   podman run --rm \
#     --read-only \
#     --tmpfs /var/cache/nginx:rw,size=10m \
#     --tmpfs /var/run:rw,size=1m \
#     -p 80:8080 \
#     --name dart-tracker \
#     dart-tracker:latest
#
# Security notes:
#   - nginx:alpine minimises the installed package set (~7 MB base image).
#   - server_tokens off is set in nginx.conf (no version disclosure).
#   - The container worker processes run as the 'nginx' non-root user.
#   - Port 8080 is used internally so the process does not need CAP_NET_BIND_SERVICE.
#   - No npm/pip/runtime dependencies ship in the image; pure static assets only.
# =============================================================================

FROM docker.io/library/nginx:1.27-alpine

# Remove the default nginx virtual host so only our config is active.
RUN rm -f /etc/nginx/conf.d/default.conf

# Copy application files.
COPY nginx.conf        /etc/nginx/conf.d/dart-tracker.conf
COPY www/              /usr/share/nginx/html/

# Pre-create all directories nginx needs to write to at runtime and give
# ownership to the nginx user. Without this, the non-root process cannot
# create the client_temp and other cache subdirectories on startup.
RUN chown -R nginx:nginx \
      /usr/share/nginx/html \
      /var/cache/nginx \
      /var/log/nginx \
    && chmod -R 755 /var/cache/nginx \
    # nginx.conf references a pid file; make sure the parent dir is writable too.
    && touch /var/run/nginx.pid \
    && chown nginx:nginx /var/run/nginx.pid

# Expose the internal port (mapped to host port 80 via `podman run -p 80:8080`).
EXPOSE 8080

# Run as non-root nginx user (master process stays root only to bind the port
# — at 8080 that privilege is not needed, so we can drop entirely).
USER nginx

# nginx starts via the default CMD inherited from the base image.
