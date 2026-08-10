# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

# Render + TiDB deployment update

Replace the matching files in your repository with the files in this archive.

Updated files:
- server/db/connect.js
- server/utils/authCookie.js (new)
- server/controllers/System/users.controllers.js
- server/server.js
- server/.env.example
- client/.env.example

Render settings:
- Root Directory: server
- Build Command: npm install
- Start Command: npm start
- Health Check Path: /api/v1/health

Required Render database variables:
- TIDB_HOST
- TIDB_PORT=4000
- TIDB_USERNAME
- TIDB_PASSWORD
- TIDB_DATABASE=dc_prime_realty_system_db
- TIDB_SSL=true


