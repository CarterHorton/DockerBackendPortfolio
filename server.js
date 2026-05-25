const express =  require('express')
const pool = require('./db')

const port = 3000

const app = express()
app.use(express.json()) // Allows the use of JSON file type


app.get('/',(req, res) => {
    res.sendStatus(200)
})

app.listen(port, () => console.log(`Server has started on port: ${port}`))