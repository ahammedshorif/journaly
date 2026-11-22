process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.SUPABASE_URL = "https://test-project.supabase.co";
process.env.SUPABASE_JWT_SECRET = "test-secret-at-least-32-characters-long!!";
process.env.CLIENT_ORIGIN = "http://localhost:3000";
