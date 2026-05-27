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
            top5: data.rows
        })
    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }
})

app.get('/projects/top5', async (req, res) => {
    // This endpoint will get the top five most recently created journals
    sql = `SELECT * FROM projects ORDER BY start_date DESC LIMIT 5;`
    try {
        const data = await pool.query(sql)

        res.status(200).send({
            top5: data.rows
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

// delete request
app.delete('/journal/:id', async (req, res) => {
    const passedID = req.params.id

    // delete the passed ID instance of journal
    const sql = `DELETE FROM journals WHERE ID = ($1)`

    try {
        console.log(`Deleting from journal ID: ${passedID}`)
        const result = await pool.query(sql, [passedID])
    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }
})

app.delete('/project/:id', async (req, res) => {
    const passedID = req.params.id

    // delete the passed ID instance of journal
    const sql = `DELETE FROM projects WHERE ID = ($1)`

    try {
        console.log(`Deleting from project ID: ${passedID}`)
        const result = await pool.query(sql, [passedID])
    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }
})

// update request
app.patch('/journal/title/:id', (req, res) => {
    // We want to update the title, based off the id
    const passedID = req.params.id
    const newTitle = req.body.title

    const sql = `UPDATE journals
    SET title = ($1)
    WHERE ID = ($2);`

    try {
        const result = pool.query(sql, [newTitle, passedID])
        res.status(200).send({
            message: "Successfully modified journal title"
        })
    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }
})

app.patch('/journal/content/:id', (req, res) => {
    // We want to update the title, based off the id
    const passedID = req.params.id
    const newContent = req.body.content

    const sql = `UPDATE journals
    SET content = ($1)
    WHERE ID = ($2);`

    try {
        const result = pool.query(sql, [newContent, passedID])
        res.status(200).send({
            message: "Successfully modified journal content"
        })
    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }
})

app.patch('/project/title/:id', (req, res) => {
    // We want to update the title, based off the id
    const passedID = req.params.id
    const newTitle = req.body.title

    const sql = `UPDATE projects
    SET title = ($1)
    WHERE ID = ($2);`

    try {
        const result = pool.query(sql, [newTitle, passedID])
        res.status(200).send({
            message: "Successfully modified project title"
        })
    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }
})

app.patch('/project/content/:id', (req, res) => {
    // We want to update the title, based off the id
    const passedID = req.params.id
    const newContent = req.body.content

    const sql = `UPDATE projects
    SET content = ($1)
    WHERE ID = ($2);`

    try {
        const result = pool.query(sql, [newContent, passedID])
        res.status(200).send({
            message: "Successfully modified project content"
        })
    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }
})

app.patch('/project/end/:id', (req, res) => {
    const passedID = req.params.id
    const sql = `UPDATE projects
    SET end_date = CURRENT_TIMESTAMP
    WHERE ID = ($1)`

    try {
        const result = pool.query(sql, [passedID])
        res.status(200).send({
            message: "Successfully ended project"
        })
    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }
})


setupDatabase()

app.listen(port, () => console.log(`Server has started on port: ${port}`))
