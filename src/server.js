require('dotenv').config()
const express = require('express')
const { setup, pool } = require('./db')
const fs = require('fs-extra')
const path = require('path')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')
// Custom helper utils
const { testProjID } = require('./utils/testProjID')
const { queryFromFile } = require('./utils/queryFromFile')

const singleUser = {
    username: "Mr.FrogMan",
    password: "$2b$10$3OS9SzdcEozLL4FV517TEuMl7bisUnAHGfzQmfPx/J.Y59vv7sPFm"
}
const port = 3000

const app = express()
app.use(express.json()) // Allows the use of JSON file type
// Setup CORS to trust the server
const cors = require('cors')
app.use(cors({ origin: 'carterbhorton.com',
    credentials: true
 }))
// rate limiting for Express
const rateLimit = require('express-rate-limit')
// Rate limiting
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // Set the time to 15 minute period
    max: 3,
    message: { error: 'Too many login attempts, please try again later.'},
    standardHeaders: true,
    legacyHeaders: false
})
const getApiRateLimit = rateLimit({
    windowMs: 60 * 60 * 1000, // Set the time to be over the course of an hour
    max: 50,
    // Logs every time a request is blocked
    handler: (req, res, next, options) => {
        console.log({
        event: 'rate_limit_exceeded',
        ip: req.ip,
        path: req.path,
        timestamp: new Date().toISOString()
        });
        res.status(429).json({ error: 'Too many requests' });
    },

    // Logs only when the limit is first reached
})
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

// Authentication
app.post('/supersecretadmin/login', loginLimiter, async (req, res) => {
    const username = req.body.username
    const password = req.body.password

    const isPassed = await bcrypt.compare(password, singleUser.password)
    if (username === singleUser.username && isPassed) {
        console.log("login")

        const user = { name: username }

        const accessToken = jwt.sign(user, process.env.SUPER_DUPER_SECRET_KEY, { expiresIn: '1h' })
        res.json({
            accessToken: accessToken
        })
    } else {
        console.log(`Attempted Login: ${username}, ${password}`)
        res.status(401).send({error: "Invalid username or password"})
    }
})

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1]

    if (token == null) return res.sendStatus(401)
    
    jwt.verify(token, process.env.SUPER_DUPER_SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403)
        req.user = user
        next()
    })
}



// get request
// app.get('/', async (req, res) => {
//     re404(req, res)
// })

app.get('/projects', getApiRateLimit, async (req, res) => {
    try {
        const data = await pool.query(`SELECT * FROM projects
            ORDER by start_date DESC;`)

        res.status(200).send({
            children: data.rows
        })
    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }
})

app.get('/journals', getApiRateLimit, async (req, res) => {
    try {
        const data = await pool.query(`SELECT journals.ID, journals.project_id, journals.title, journals.content, journals.date_created,
            projects.title AS p_title
            FROM journals
            JOIN projects
            ON journals.project_id = projects.id
            ORDER BY journals.date_created DESC
            ;`)

        res.status(200).send({
            children: data.rows
        })
    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }
})

app.get('/journal/:id', getApiRateLimit, async (req, res) => {
    try {
        const data = await pool.query('SELECT * FROM journals WHERE ID=($1)', [req.params.id])

        res.status(200).send({
            children: data.rows
        })
    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }
})

app.get('/project/:id', getApiRateLimit, async (req, res) => {
    try {
        const data = await pool.query('SELECT * FROM projects WHERE ID=($1)', [req.params.id])

        res.status(200).send({
            children: data.rows
        })
    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }
})

app.get('/journals/top5', getApiRateLimit, async (req, res) => {
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

app.get('/projects/top5', getApiRateLimit, async (req, res) => {
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

app.get('/test', getApiRateLimit, async (req, res) => {
    res.status(200).send({
        message: "Server is online and working"
    })
})

app.get('/verifyToken', authenticateToken, (req, res) => {
    res.status(200).send({
        username: req.user.name
    })
})

// post request
app.post('/project', authenticateToken, async (req, res) => {
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

app.post('/journal', authenticateToken, async (req, res) => {
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
app.delete('/journal/:id', authenticateToken, async (req, res) => {
    const passedID = req.params.id

    // delete the passed ID instance of journal
    const sql = `DELETE FROM journals WHERE ID = ($1)`

    try {
        console.log(`Deleting from journal ID: ${passedID}`)
        const result = await pool.query(sql, [passedID])
        res.sendStatus(204)
    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }
})

app.delete('/project/:id', authenticateToken,   async (req, res) => {
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
app.patch('/journal/title/:id', authenticateToken, (req, res) => {
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

app.patch('/journal/content/:id', authenticateToken, (req, res) => {
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

app.patch('/project/title/:id', authenticateToken, (req, res) => {
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

app.patch('/project/content/:id', authenticateToken, (req, res) => {
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

app.get('/project/end/:id', authenticateToken, (req, res) => {
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

// Update whole journal
app.patch('/journal/:id', authenticateToken, (req, res) => {
    const passedID = req.params.id
    const project_id = req.body.project_id
    const title = req.body.title
    const content = req.body.content
    const sql = `UPDATE journals
    SET project_id = ($1), title = ($2), content = ($3)
    WHERE ID = ($4)`

    try {
        const result = pool.query(sql, [project_id, title, content, passedID])
        res.status(200).send({
            message: "Successfully updated journal"
        })
    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }
})
// Update whole project
app.patch('/project/:id', authenticateToken, (req, res) => {
    const passedID = req.params.id
    const title = req.body.title
    const content = req.body.content
    const sql = `UPDATE projects
    SET title = ($1), content = ($2)
    WHERE ID = ($3)`

    try {
        const result = pool.query(sql, [title, content, passedID])
        res.status(200).send({
            message: "Successfully updated project"
        })
    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }
})


setupDatabase()

app.listen(port, () => console.log(`Server has started on port: ${port}`))