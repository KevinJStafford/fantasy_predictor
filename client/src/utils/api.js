// API configuration utility
// In development, uses proxy from package.json
// In production, uses REACT_APP_API_URL environment variable

const getApiUrl = () => {
  // Check if we're in production and have an API URL set
  if (process.env.NODE_ENV === 'production' && process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
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
