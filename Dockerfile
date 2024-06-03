# Build stage
FROM gcr.io/google-appengine/nodejs as build

WORKDIR /app
COPY . /app
RUN npm install --only=prod
RUN npm run build

# Run stage
FROM gcr.io/google-appengine/nodejs

COPY --from=build /app /app

# Serve assets in build mode
ENV MODE build
ENV ENV_ID dev

CMD ["npm", "run", "start:prod"]
# is a default command defined in gcr.io/google-appengine/nodejs image
