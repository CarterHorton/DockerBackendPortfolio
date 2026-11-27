/* Create the admin account, or reset its password / make an existing user an admin.

 Run inside the app container (the server must have started once, so the
 users table exists):
   docker compose exec app node scripts/create-admin.js

 It asks for the username and password (the password is not shown as you type).
*/
const readline = require('readline')
const { pool } = require('../src/db')
const { validateCredentials, hashPassword } = require('../src/auth')

// Interactive: prompt in the terminal, hiding the password as it's typed.
function askTerminal(rl, question, hidden) {
    return new Promise((resolve) => {
        if (!hidden) return rl.question(question, resolve)
        const write = rl._writeToOutput.bind(rl)
        rl._writeToOutput = (text) => { if (text.includes(question)) write(text) }
        rl.question(question, (answer) => {
            rl._writeToOutput = write
            process.stdout.write('\n')
            resolve(answer)
        })
    })
}

// Piped input (e.g. printf 'name\npass\npass\n' | node scripts/create-admin.js): one answer per line.
async function readPipedLines() {
    let data = ''
    for await (const chunk of process.stdin) data += chunk
    return data.split(/\r?\n/)
}

async function main() {
    let username, password, again
    if (process.stdin.isTTY) {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
        username = await askTerminal(rl, 'Admin username: ')
        password = await askTerminal(rl, 'Password (min 12 characters): ', true)
        again = await askTerminal(rl, 'Repeat password: ', true)
        rl.close()
    } else {
        [username = '', password = '', again = ''] = await readPipedLines()
    }
    username = username.trim()

    if (password !== again) throw new Error('Passwords do not match')
    const problem = validateCredentials(username, password)
    if (problem) throw new Error(problem)

    const hash = await hashPassword(password)
    const result = await pool.query(
        `INSERT INTO users (username, password_hash, role) VALUES ($1, $2, 'admin')
         ON CONFLICT ((lower(username))) DO UPDATE
           SET password_hash = EXCLUDED.password_hash, role = 'admin', disabled = false
         RETURNING (xmax = 0) AS created`,
        [username, hash])
    // Log out existing sessions for this account, so an old login can't keep using the old password
    await pool.query(`DELETE FROM session WHERE (sess -> 'passport' ->> 'user')::int =
                      (SELECT ID FROM users WHERE lower(username) = lower($1))`, [username])
    console.log(result.rows[0].created ? `Created admin "${username}"` : `Updated "${username}": password reset, role admin`)
}

main()
    .catch((err) => {
        if (err.code === '42P01') console.log('The users table does not exist yet: start the server once so migrations run, then retry.')
        else console.log(`Error: ${err.message}`)
        process.exitCode = 1
    })
    .finally(() => pool.end())
