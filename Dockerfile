# Install Node.js
FROM node:10-alpine
RUN apk update
RUN apk add --no-cache bash

#---------------------------------------------
# Define mountable directories
#---------------------------------------------
VOLUME ["/usr/smarthome"]

#---------------------------------------------
# Install mox-home package
#---------------------------------------------
WORKDIR /usr/smarthome/mox

COPY package*.json ./
RUN npm install
COPY . .

#---------------------------------------------
# Expose ports
#---------------------------------------------

# MOX
EXPOSE 6666
EXPOSE 6666/udp
EXPOSE 6670
EXPOSE 6670/udp

# Redis
EXPOSE 6379

#---------------------------------------------
# Wait for MongoDb container to be up, so we can run queries
# See: https://medium.com/@krishnaregmi/wait-for-it-docker-compose-f0bac30f3357
#---------------------------------------------

#---------------------------------------------
# Initialize the smart home script
#---------------------------------------------
ENV NODE_ENV=production
RUN chmod 755 ./docker-startup.sh

ENTRYPOINT ["./docker-startup.sh"]
# RUN node ./moxd.js --init /usr/smarthome/mox/storage/prod.json

# Start the daemon
# ENTRYPOINT ["node", "test.js"]