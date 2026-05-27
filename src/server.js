const express = require('express')
const { setup, pool } = require('./db')
const fs = require('fs-extra')
const path = require('path')
// Custom helper utils
const { testProjID } = require('./utils/testProjID')
const { queryFromFile } = require('./utils/queryFromFile')

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

app.get('/journals/top5', async (req, res) => {
    // This endpoint will get the top five most recently created journals
    sql = `SELECT * FROM journals ORDER BY date_created DESC LIMIT 5;`
    try {
        const data = await pool.query(sql)

        res.status(200).send({
            top5: data
        })
    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }
})

app.get('/test', async (req, res) => {
    res.status(200).send({
        message1: "Server is online and working"
    })
})

// post request
app.post('/project', async (req, res) => {
    const {title, content} = req.body
    console.log(`Post - Project ${title}`)
    sql = "INSERT INTO projects (title, content) VALUES ($1, $2)"
    try {
        const result = pool.query(sql, [title, content])
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

    // Check that project_id exist
    const isID = await testProjID(project_id)
    if (!isID) {
        return res.status(422).send({
            err: `The project ID: ${project_id} does not exist`
        })
    }
    console.log(`Post - Journal ${title}`)
    sql = "INSERT INTO journals (project_id, title, content) VALUES ($1, $2, $3)"
    try {
        const result = pool.query(sql, [project_id, title, content])
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
