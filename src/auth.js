/* Authentication: Passport (username + password) with server-side sessions.

 - Logging in creates a session stored in Postgres (table "session"); the
   browser only gets an HttpOnly cookie, which page scripts can't read.
 - requireAdmin protects everything that changes site content.
 - requireAuth is for future features any logged-in user may use.
 - Registration exists but is off unless ALLOW_REGISTRATION=true.

 Create or reset the admin account with: node scripts/create-admin.js
*/
const express = require('express')
const session = require('express-session')
const PgStore = require('connect-pg-simple')(session)
const passport = require('passport')
const LocalStrategy = require('passport-local').Strategy
const bcrypt = require('bcrypt')
const { pool } = require('./db')

const BCRYPT_ROUNDS = 12
const SESSION_HOURS = 24 // expires after this long without any requests
const USERNAME = /^[A-Za-z0-9_.-]{3,32}$/
const PASSWORD_MIN = 12
const PASSWORD_MAX_BYTES = 72 // bcrypt ignores anything longer

// Used when the username doesn't exist, so a wrong username takes as long as
// a wrong password (otherwise response time reveals which usernames exist).
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS)

// The fields that are safe to send to the browser
function publicUser(user) {
    return { id: user.id, username: user.username, role: user.role }
}

passport.use(new LocalStrategy(async (username, password, done) => {
    try {
        const result = await pool.query(
            'SELECT * FROM users WHERE lower(username) = lower($1)', [username])
        const user = result.rows[0]
        const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH)
        if (!user || !ok || user.disabled) return done(null, false)
        await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE ID = $1', [user.id])
        return done(null, user)
    } catch (err) {
        return done(err)
    }
}))

// The session stores only the user id; the rest is loaded fresh on each
// request, so disabling an account or changing a role applies immediately.
passport.serializeUser((user, done) => done(null, user.id))
passport.deserializeUser(async (id, done) => {
    try {
        const result = await pool.query(
            'SELECT ID, username, role, disabled FROM users WHERE ID = $1', [id])
        const user = result.rows[0]
        done(null, user && !user.disabled ? user : false)
    } catch (err) {
        done(err)
    }
})

function setupAuth(app) {
    const secret = process.env.SESSION_SECRET
    if (!secret || secret.length < 32) {
        throw new Error('SESSION_SECRET must be set in .env (at least 32 characters, e.g. `openssl rand -hex 32`)')
    }
    const secureCookie = process.env.COOKIE_SECURE === 'true'

    // Behind nginx / Cloudflare: trust forwarding headers from private-network
    // proxies, so req.ip is the visitor's address (rate limits are per visitor)
    // and req.secure reflects the original HTTPS request.
    app.set('trust proxy', process.env.TRUST_PROXY || 'loopback, linklocal, uniquelocal')

    app.use(session({
        store: new PgStore({ pool, tableName: 'session' }),
        name: 'portfolio.sid',
        secret,
        resave: false,
        saveUninitialized: false, // no cookie until someone logs in
        rolling: true,            // each request pushes the expiry back
        cookie: {
            httpOnly: true,
            sameSite: 'strict',   // never sent with requests from other sites (CSRF protection)
            secure: secureCookie, // HTTPS only; set COOKIE_SECURE=true in production
            maxAge: SESSION_HOURS * 60 * 60 * 1000
        }
    }))
    app.use(passport.session())
}

function requireAuth(req, res, next) {
    if (req.isAuthenticated()) return next()
    res.status(401).send({ err: 'Not logged in' })
}

function requireAdmin(req, res, next) {
    if (!req.isAuthenticated()) return res.status(401).send({ err: 'Not logged in' })
    if (req.user.role !== 'admin') return res.status(403).send({ err: 'Admins only' })
    next()
}

function validateCredentials(username, password) {
    if (typeof username !== 'string' || !USERNAME.test(username)) {
        return 'Username must be 3-32 characters: letters, numbers, _ . -'
    }
    if (typeof password !== 'string' || password.length < PASSWORD_MIN) {
        return `Password must be at least ${PASSWORD_MIN} characters`
    }
    if (Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) {
        return `Password must be at most ${PASSWORD_MAX_BYTES} bytes`
    }
    return null
}

async function hashPassword(password) {
    return bcrypt.hash(password, BCRYPT_ROUNDS)
}

function authRoutes({ loginLimiter, registerLimiter }) {
    const router = express.Router()

    router.post('/auth/login', loginLimiter, (req, res, next) => {
        if (process.env.COOKIE_SECURE === 'true' && !req.secure) {
            console.log('Warning: COOKIE_SECURE=true but this request did not arrive over HTTPS ' +
                '(check that the proxy sends X-Forwarded-Proto). The login cookie will not be set.')
        }
        passport.authenticate('local', (err, user) => {
            if (err) return next(err)
            if (!user) {
                // Never log the password that was tried
                console.log(`Failed login for "${String(req.body?.username).slice(0, 64)}" from ${req.ip}`)
                return res.status(401).send({ err: 'Invalid username or password' })
            }
            // logIn starts a fresh session id (prevents session fixation)
            req.logIn(user, (loginErr) => {
                if (loginErr) return next(loginErr)
                console.log(`Login: ${user.username}`)
                res.status(200).send(publicUser(user))
            })
        })(req, res, next)
    })

    router.post('/auth/logout', (req, res, next) => {
        req.logout((err) => {
            if (err) return next(err)
            req.session.destroy(() => {
                res.clearCookie('portfolio.sid')
                res.sendStatus(204)
            })
        })
    })

    // Who is logged in (401 if nobody)
    router.get('/auth/me', requireAuth, (req, res) => {
        res.status(200).send(publicUser(req.user))
    })

    // Off unless ALLOW_REGISTRATION=true. New accounts are always role 'user'.
    router.post('/auth/register', registerLimiter, async (req, res, next) => {
        if (process.env.ALLOW_REGISTRATION !== 'true') {
            return res.status(403).send({ err: 'Registration is closed' })
        }
        const { username, password } = req.body || {}
        const problem = validateCredentials(username, password)
        if (problem) return res.status(400).send({ err: problem })
        try {
            const result = await pool.query(
                `INSERT INTO users (username, password_hash, role) VALUES ($1, $2, 'user')
                 ON CONFLICT DO NOTHING RETURNING *`,
                [username, await hashPassword(password)])
            if (result.rowCount === 0) return res.status(409).send({ err: 'That username is taken' })
            const user = result.rows[0]
            req.logIn(user, (loginErr) => {
                if (loginErr) return next(loginErr)
                console.log(`Registered: ${user.username}`)
                res.status(201).send(publicUser(user))
            })
        } catch (err) {
            next(err)
        }
    })

    return router
}

module.exports = { setupAuth, authRoutes, requireAuth, requireAdmin, validateCredentials, hashPassword }
