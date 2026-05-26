const fs = require('fs-extra')
const pool = require('../db')

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

module.exports = { queryFromFile }