const express = require('express')
const { setup, pool } = require('./db')
const fs = require('fs-extra')
const path = require('path')

const port = 3000

const app = express()
app.use(express.json()) // Allows the use of JSON file type
// Setup database
async function setupDatabase () {
    await new Promise(resolve => setTimeout(resolve, 2000))
    console.log("Starting connection to database...")
    await setup()
}

// Helper functions
function re404(req, res) {
    res.status(404).sendFile(__dirname + '/pages/PageNotFound.html')
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

// get request
app.get('/', async (req, res) => {
    re404(req, res)
})

app.get('/projects', async (req, res) => {
    try {
        const data = await pool.query('SELECT * FROM projects')

        res.status(200).send({
            children: data.rows
        })
    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }
})

app.get('/journals', async (req, res) => {
    try {
        const data = await pool.query('SELECT * FROM journals')

        res.status(200).send({
            children: data.rows
        })
    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }
})

// post request
app.post('/project', async (req, res) => {
    const {title, content} = req.body
    console.log(`Post - Project ${title}`)
    sql = "INSERT INTO projects (title, content) VALUES ($1, $2)"
    try {
        result = pool.query(sql, [title, content])
        console.log(result)
        res.status(200).send({
            message: "Added project to database"
        })
    } catch (err) {
        console.log(err)
        res.status(500).send({
            err: "An error occured while attempting to update the database"
        })
    }
})

app.post('/journal', async (req, res) => {
    const {project_id, title, content} = req.body
    console.log(`Post - Journal ${title}`)
    sql = "INSERT INTO journals (project_id, title, content) VALUES ($1, $2, $3)"
    try {
        result = pool.query(sql, [project_id, title, content])
        console.log(result)
        res.status(200).send({
            message: "Added journal to database"
        })
    } catch (err) {
        console.log(err)
        res.status(500).send({
            err: "An error occured while attempting to update the database"
        })
    }
})


setupDatabase()

app.listen(port, () => console.log(`Server has started on port: ${port}`))
