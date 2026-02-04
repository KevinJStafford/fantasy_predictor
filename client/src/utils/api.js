// API configuration utility
// In development, uses proxy from package.json
// In production, uses REACT_APP_API_URL (set at build time) or fallback below

import { getAuthHeaders } from './auth';

// Fallback when REACT_APP_API_URL is not set in production build (e.g. missing in Vercel/Netlify)
const PRODUCTION_API_FALLBACK = 'https://fantasy-predictor-api.onrender.com';

const getApiUrl = () => {
  if (process.env.NODE_ENV === 'production') {
    const url = (process.env.REACT_APP_API_URL || PRODUCTION_API_FALLBACK).replace(/\/$/, '');
    return url;
  }
  // In development, use relative paths (proxy handles it)
  return '';
};

export const API_BASE_URL = getApiUrl();

// Helper function to build full API URLs
export const apiUrl = (path) => {
  const base = API_BASE_URL;
  // Ensure path starts with /
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
};

// Helper function to make authenticated API requests
export const authenticatedFetch = (path, options = {}) => {
  const url = apiUrl(path);
  const headers = {
    ...getAuthHeaders(),
    ...(options.headers || {})
  };
  
  return fetch(url, {
    ...options,
    headers,
    credentials: 'include' // Still include cookies for backward compatibility
  });
};
