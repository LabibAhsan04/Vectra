FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Used for production image builds; compose also passes VITE_API_URL at runtime for dev
ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=$VITE_API_URL

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]
