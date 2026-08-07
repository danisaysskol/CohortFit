# Next.js frontend (Lab Ledger design system). Dev server for the hackathon demo.
FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

ENV NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 \
    NEXT_TELEMETRY_DISABLED=1

EXPOSE 3000
CMD ["npm", "run", "dev"]
