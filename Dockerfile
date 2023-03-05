FROM node:18-alpine
WORKDIR /app
COPY package* .

# This configures sqlite data storage by default
RUN apk add sqlite
RUN npm install
RUN npm install sqlite3

COPY esb.sh .
COPY www www
COPY src src
COPY config-server.mjs .
COPY config-client.mjs .
COPY texture-offsets.js .

# Configure sqlite database
RUN cat src/lib/chunk-stores/schema-sqlite.sql | sqlite3 voxeling.db

RUN /bin/sh /app/esb.sh
CMD ["npm", "start"]
EXPOSE 9966
