# Build the React frontend
FROM node:22-bookworm-slim AS frontend
WORKDIR /frontend
COPY Reddit-Clone-Frontend/package.json Reddit-Clone-Frontend/package-lock.json ./
RUN npm ci
COPY Reddit-Clone-Frontend/ ./
RUN npm run build

# Backend serves the API, websockets and the built frontend
FROM node:22-bookworm-slim
WORKDIR /app
COPY Reddit-Clone-Backend/package.json Reddit-Clone-Backend/package-lock.json ./
# Dev dependencies are kept because sequelize-cli runs the migrations on startup
RUN npm ci
COPY Reddit-Clone-Backend/ ./
COPY --from=frontend /frontend/build ./build

ENV NODE_ENV=production
EXPOSE 3001
CMD ["sh", "-c", "npm run db:migrate:prod && npm start"]
