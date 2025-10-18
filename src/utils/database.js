const { Pool } = require('pg');
const logger = require('./logger');

// Database connection pool
let pool = null;

// Database configuration
const dbConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'synthai_db',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres123',
  // Connection pool settings
  max: 10, // Maximum number of connections
  idleTimeoutMillis: 30000, // 30 seconds
  connectionTimeoutMillis: 2000 // 2 seconds
};

// Connect to database
const connectDatabase = async () => {
  try {
    pool = new Pool(dbConfig);

    // Test connection
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();

    logger.info('Database connected successfully', {
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database
    });

    return pool;
  } catch (error) {
    logger.error('Database connection failed:', error);
    throw error;
  }
};

// Query function
const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;

    logger.debug('Database query executed', {
      query: text,
      duration: `${duration}ms`,
      rows: result.rowCount
    });

    return result;
  } catch (error) {
    logger.error('Database query error:', {
      query: text,
      params,
      error: error.message
    });
    throw error;
  }
};

// Get client from pool
const getClient = async () => {
  try {
    return await pool.connect();
  } catch (error) {
    logger.error('Failed to get database client:', error);
    throw error;
  }
};

// Close database connection
const closeConnection = async () => {
  if (pool) {
    await pool.end();
    logger.info('Database connection closed');
  }
};

module.exports = {
  connectDatabase,
  query,
  getClient,
  closeConnection
};
