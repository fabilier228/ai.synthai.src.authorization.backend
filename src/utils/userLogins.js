const { query } = require('./database');
const logger = require('./logger');

const updateLastLogin = async sub => {
  const now = new Date();

  try {
    await query(
      `
        INSERT INTO user_last_login (keycloak_sub, last_login)
        VALUES ($1, $2)
        ON CONFLICT (keycloak_sub)
        DO UPDATE SET 
          last_login = EXCLUDED.last_login,
          updated_at = NOW()
      `,
      [sub, now]
    );
  } catch (error) {
    // Nie blokujemy logowania jeśli zapis last_login się wywali
    logger.error('Failed to update last_login', {
      sub,
      error: error.message
    });
  }
};

const getLastLogin = async sub => {
  const result = await query(
    'SELECT last_login FROM user_last_login WHERE keycloak_sub = $1',
    [sub]
  );

  return result.rows[0]?.last_login || null;
};

module.exports = {
  updateLastLogin,
  getLastLogin
};
