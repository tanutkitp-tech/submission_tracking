const localDevelopmentOrigin = /^http:\/\/(?:localhost|127\.0\.0\.1):(5173|5174)$/i;

function isAllowedOrigin(origin, configuredOrigins, isProduction) {
  if (!origin) return true;
  if (configuredOrigins.includes(origin)) return true;
  return !isProduction && localDevelopmentOrigin.test(origin);
}

module.exports = { isAllowedOrigin };
