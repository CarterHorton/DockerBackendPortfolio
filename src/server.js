const express =  require('express')
const pool = require('./db')

const port = 3000

const app = express()
app.use(express.json()) // Allows the use of JSON file type

function re404(req, res) {
    res.status(404).sendFile(__dirname + '/pages/PageNotFound.html')
}

app.get('/',(req, res) => {
    re404(req, res)
})

app.post('/', (req, res) => {
    const {title, content} = req.body
    console.log(content)
    res.status(200).send({
        "Message": `Creating new project: ${title}`
    })
})

app.listen(port, () => console.log(`Server has started on port: ${port}`))
