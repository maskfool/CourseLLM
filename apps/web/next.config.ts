// next.config.js
/** @type {import('next').NextConfig} */
const INGEST_BASE = process.env.INGEST_BASE || 'http://localhost:5001';

module.exports = {
  async rewrites() {
    return [
      // forward all ingest endpoints to the worker
      { source: '/api/ingest/:path*', destination: `${INGEST_BASE}/api/ingest/:path*` },
      { source: '/api/docs/:path*',   destination: `${INGEST_BASE}/api/docs/:path*` },
    ];
  },
};