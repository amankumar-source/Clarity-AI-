# Clarity AI

A minimal, production-ready MERN stack application that turns complex text into one clear sentence using OpenAI.

## Prerequisites

- Node.js installed.
- OpenAI API Key.

## Setup

1. **Backend**:
   ```bash
   cd server
   npm install
   ```
   - Create a `.env` file in `server/` with:
     ```
     PORT=5000
     OPENAI_API_KEY=your_api_key_here
     ```

2. **Frontend**:
   ```bash
   cd client
   npm install
   ```

## Running the App

1. Start the backend:
   ```bash
   cd server
   npm start
   ```
   (Server runs on http://localhost:5000)

2. Start the frontend:
   ```bash
   cd client
   npm run dev
   ```
   (Frontend runs on http://localhost:5173)

3. Open the frontend URL, enter text, and click "Clarify".
