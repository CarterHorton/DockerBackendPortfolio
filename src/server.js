const express =  require('express')
const pool = require('./db')
const fs = require('fs-extra')
const path = require('path')

const port = 3000

const app = express()
app.use(express.json()) // Allows the use of JSON file type

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
            console.log("Error executing sql")
            return 0
        }
    } catch (err) {
        console.log(`Failed while reading ${filePath}`)
        console.log(err)
        return 0
    }
}

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

app.post('/', async (req, res) => {
    const {title, content} = req.body
    console.log(content)
    res.status(200).send({
        "Message": `Creating new project: ${title}`
    })
})

app.get('/setup', async (req, res) => {
    const result = await queryFromFile(path.join(__dirname, '/queries/setup.sql'))
    if (result == 1) {
        res.status(200).send({
            message: "successfully set up the database with seeding"
        })
    } else {
        res.status(500).send({
            message: "There was a problem with the server"
        })
    }
})

app.listen(port, () => console.log(`Server has started on port: ${port}`))
