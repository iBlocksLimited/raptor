# To use this image, you will need to provide a GTFS file at the path pointed
# to by the GTFS_DATA_FILE environment variable.

# To build the image, make sure to npm install && npm run prepublishOnly so
# that the dist folder is created.

FROM node:12.0.0

RUN mkdir -p /home/raptor/
WORKDIR /home/raptor/

COPY package*.json ./
RUN npm install

COPY dist dist

ENV GTFS_DATA_FILE=/home/raptor/gtfs.zip

EXPOSE 3000
EXPOSE 3001

ENTRYPOINT node /home/raptor/dist/src/runner.js $GTFS_DATA_FILE
