const { Pool } = require('pg')
const path = require('path')
const fs = require('fs-extra')

const pool = new Pool({
    host: 'db',
    port: 5432,
    user: 'chorton',
    password: 'durmoh-gInzat-tafno3',
    database: 'portfolio'
})

// An idle connection can drop (e.g. the database restarts). Without this
// handler that error is unhandled and crashes the whole server; with it the
// pool just discards the dead connection and opens a new one on the next query.
pool.on('error', (err) => {
    console.log(`Database connection lost: ${err.message}`)
})

async function tableExist (tableName) {
    try {
        const result = await pool.query(`
            SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
            );
            `, [tableName])
        return result.rows[0].exists
    } catch (err) {
        console.log(`Error checking table ${tableName}`)
        return false
    }
}

async function queryFromFile(filePath){
    try {
        const sql = await fs.readFile(filePath, 'utf8');
        // Seperate out the different sql queries
        const queries = sql
        .split(';')
        .map(query => query.trim())
        .filter(query => query.length > 0)

        try {
            await pool.query('BEGIN'); // Start the transaction

            for (const query of queries) {
                await pool.query(query)
            }

            await pool.query('COMMIT')
            console.log(`Queried - ${filePath}`)
            return 1
        } catch (err) {
            if (err != 'relation "projects" already exists') {
                console.log("Error executing sql")
            }
            return 0
        }
    } catch (err) {
        console.log(`Failed while reading ${filePath}`)
        console.log(err)
        return 0
    }
}

// Applies every file in queries/migrations that hasn't been applied yet, in
// filename order. Each file runs in its own transaction on a single client,
// and is recorded in schema_migrations so it never runs twice.
// To change the schema later: add a new numbered file, never edit an old one.
async function runMigrations() {
    const dir = path.join(__dirname, 'queries', 'migrations')
    const files = (await fs.readdir(dir)).filter(f => f.endsWith('.sql')).sort()

    await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`)
    const applied = new Set(
        (await pool.query('SELECT name FROM schema_migrations')).rows.map(r => r.name)
    )

    for (const file of files) {
        if (applied.has(file)) continue
        const sql = await fs.readFile(path.join(dir, file), 'utf8')
        const client = await pool.connect()
        try {
            await client.query('BEGIN')
            await client.query(sql)
            await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file])
            await client.query('COMMIT')
            console.log(`Applied migration ${file}`)
        } catch (err) {
            await client.query('ROLLBACK')
            console.log(`Migration ${file} failed, rolled back`)
            throw err
        } finally {
            client.release()
        }
    }
}

async function setup() {
    // Check if setup has already occured
    if (await tableExist('projects')) {
        console.log(`Setup has already occured`)
    } else {
        var result = await queryFromFile(path.join(__dirname, '/queries/setup.sql'))

        if (result == 1) {
            result = await queryFromFile(path.join(__dirname, '/queries/seeding.sql'))
        }
        if (result == 0) {
            console.log("Something went wrong during Database Setup")
        } else {
            console.log("successfully set up the database with seeding")
        }
    }
    await runMigrations()
}

// export so that server.js can use this setup
module.exports = { pool, setup, tableExist }