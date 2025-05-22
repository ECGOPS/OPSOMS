import helmet from 'helmet';

export const securityConfig = {
  helmet: helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://*.google.com", "https://*.googleapis.com", "https://*.gstatic.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://*.google.com", "https://*.googleapis.com", "https://*.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:", "blob:", "https://*.google.com", "https://*.googleapis.com", "https://*.gstatic.com"],
        connectSrc: ["'self'", "https:", "wss:", "https://*.google.com", "https://*.googleapis.com", "https://www.google.com"],
        fontSrc: ["'self'", "data:", "https:", "https://*.google.com", "https://*.gstatic.com"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'self'", "https://www.google.com", "https://www.google.com/maps/", "https://*.googleapis.com", "https://*.gstatic.com"],
        workerSrc: ["'self'", "blob:"],
        manifestSrc: ["'self'"],
        prefetchSrc: ["'self'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    xssFilter: true,
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    frameguard: {
      action: 'deny'
    },
    dnsPrefetchControl: {
      allow: false
    },
    ieNoOpen: true,
    permittedCrossDomainPolicies: {
      permittedPolicies: 'none'
    },
    hidePoweredBy: true,
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: {
      policy: 'same-origin'
    },
    crossOriginResourcePolicy: {
      policy: 'same-site'
    },
    originAgentCluster: true
  }),
  cors: {
    origin: process.env.VITE_APP_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    exposedHeaders: ['Content-Length', 'X-CSRF-Token'],
    maxAge: 86400 // 24 hours
  },
  session: {
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
    },
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
  },
}; 