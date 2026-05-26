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

// export so that server.js can use this setup
module.exports = { pool, setup, tableExist }