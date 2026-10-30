require("dotenv").config();

const databaseUri = process.env.DATABASE_URI;
const testDatabaseUri = process.env.TEST_DATABASE_URI;

if (process.env.NODE_ENV !== "test") {
  throw new Error("Test database guard must run with NODE_ENV=test.");
}

if (!testDatabaseUri) {
  throw new Error("TEST_DATABASE_URI must be configured before running tests.");
}

const getDatabaseTarget = (uri) => {
  const parsedUri = new URL(uri);
  const host = parsedUri.hostname || parsedUri.searchParams.get("host") || "";
  const port = parsedUri.port || parsedUri.searchParams.get("port") || "5432";
  const database = decodeURIComponent(parsedUri.pathname.replace(/^\/+/, ""));

  return `${host.toLowerCase()}:${port}/${database}`;
};

if (
  databaseUri &&
  getDatabaseTarget(databaseUri) === getDatabaseTarget(testDatabaseUri)
) {
  throw new Error(
    "Refusing to run tests: TEST_DATABASE_URI points to the same database as DATABASE_URI.",
  );
}
