# The attack box browser's way to the web: see proxy.mjs. It needs nothing but Node.
FROM node:22-alpine
WORKDIR /app
COPY proxy.mjs .
USER node
CMD ["node", "proxy.mjs"]
