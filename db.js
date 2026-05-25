const { Pool } = require('pg')
const pool = new Pool({
    host: 'db',
    port: 5432,
    user: 'chorton',
    password: "durmoh-gInzat-tafno3",
    database: 'portfolio'
})

// export so that server.js can use this setup
module.exports = pool