/* Create the admin account, or reset its password / make an existing user an admin.

 Run inside the app container (the server must have started once, so the
 users table exists):
   docker compose exec app node scripts/create-admin.js

 It asks for the username and password (the password is not shown as you type).
*/
const readline = require('readline')
const { pool } = require('../src/db')
const { validateCredentials, hashPassword } = require('../src/auth')

// Interactive: a normal visible prompt (for the username).
function askVisible(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    return new Promise((resolve) => rl.question(question, (answer) => {
        rl.close()
        resolve(answer)
    }))
}

// Interactive: read a password without echoing anything. The terminal is put
// in raw mode and keys are handled one at a time, so nothing typed (including
// edits like backspace) is ever printed.
function askHidden(question) {
    return new Promise((resolve, reject) => {
        const stdin = process.stdin
        let answer = ''
        process.stdout.write(question)
        stdin.setRawMode(true)
        stdin.setEncoding('utf8')
        stdin.resume()

        const finish = (err) => {
            stdin.removeListener('data', onData)
            stdin.setRawMode(false)
            stdin.pause()
            process.stdout.write('\n')
            err ? reject(err) : resolve(answer)
        }
        const onData = (chunk) => {
            // Ignore arrow keys and other escape sequences
            if (chunk.startsWith('\u001b')) return
            for (const ch of chunk) {
                if (ch === '\r' || ch === '\n') return finish()
                if (ch === '\u0003') return finish(new Error('Cancelled')) // Ctrl+C
                if (ch === '\u0004') return finish()                       // Ctrl+D
                if (ch === '\u007f' || ch === '\b') {                      // Backspace
                    answer = Array.from(answer).slice(0, -1).join('')
                    continue
                }
                if (ch >= ' ') answer += ch // skip other control characters
            }
        }
        stdin.on('data', onData)
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
        username = await askVisible('Admin username: ')
        password = await askHidden('Password (min 12 characters, hidden): ')
        again = await askHidden('Repeat password: ')
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
