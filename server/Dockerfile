FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN mkdir -p uploads/avatars uploads/logos
EXPOSE 5000
CMD ["npx", "tsx", "src/index.ts"]
