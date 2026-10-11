const BANGKOK_SESSION_TIME_ZONE = "SET time_zone = '+07:00'";

function createDatabaseFacade(pool) {
  async function getConnection() {
    const connection = await pool.getConnection();
    try {
      // DATETIME deadlines and the UI use Bangkok wall time. Set it on every
      // checkout so behavior does not depend on MySQL host/session defaults.
      await connection.query(BANGKOK_SESSION_TIME_ZONE);
      return connection;
    } catch (error) {
      connection.release();
      throw error;
    }
  }

  async function execute(sql, parameters) {
    const connection = await getConnection();
    try {
      return await connection.execute(sql, parameters);
    } finally {
      connection.release();
    }
  }

  return { execute, getConnection, end: () => pool.end() };
}

module.exports = { createDatabaseFacade, BANGKOK_SESSION_TIME_ZONE };
