import swaggerJSDoc from "swagger-jsdoc";

export const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "DRRCS API",
      version: "1.0.0",
      description: "Disaster Relief & Resource Coordination System REST API"
    },
    servers: [{ url: "http://localhost:4000" }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" }
      }
    },
    paths: {
      "/health": { get: { summary: "Health check", responses: { "200": { description: "API is healthy" } } } },
      "/api/auth/login": { post: { summary: "Login and receive JWT", responses: { "200": { description: "Authenticated" } } } },
      "/api/auth/register": { post: { summary: "Register a user", responses: { "201": { description: "Created" } } } },
      "/api/disasters": {
        get: { summary: "List disasters", security: [{ bearerAuth: [] }], responses: { "200": { description: "Disaster list" } } },
        post: { summary: "Create disaster", security: [{ bearerAuth: [] }], responses: { "201": { description: "Created" } } }
      },
      "/api/requests": {
        get: { summary: "List emergency requests", security: [{ bearerAuth: [] }], responses: { "200": { description: "Request list" } } },
        post: { summary: "Create emergency request", security: [{ bearerAuth: [] }], responses: { "201": { description: "Created" } } }
      },
      "/api/resources": {
        get: { summary: "List resources", security: [{ bearerAuth: [] }], responses: { "200": { description: "Resource list" } } },
        post: { summary: "Create resource", security: [{ bearerAuth: [] }], responses: { "201": { description: "Created" } } }
      },
      "/api/shelters": {
        get: { summary: "List shelters", security: [{ bearerAuth: [] }], responses: { "200": { description: "Shelter list" } } },
        post: { summary: "Create shelter", security: [{ bearerAuth: [] }], responses: { "201": { description: "Created" } } }
      },
      "/api/analytics": { get: { summary: "Dashboard analytics", security: [{ bearerAuth: [] }], responses: { "200": { description: "Analytics summary" } } } }
    }
  },
  apis: ["./src/routes/*.ts"]
});
