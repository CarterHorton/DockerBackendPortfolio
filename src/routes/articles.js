/* Articles: long-form posts written in Markdown.
 Drafts (published = false) are only visible through the authenticated routes.
*/
const express = require('express')
const { pool } = require('../db')
const { parseCoverImage } = require('./images')

const PAGE_SIZE = 5
// Fields shown in lists (everything except the full content).
const LIST_FIELDS = 'ID, title, summary, cover_image, date_published, date_updated'

function parseId(raw) {
    const id = Number(raw)
    return Number.isInteger(id) && id > 0 ? id : null
}

// Validates a create/update body. With partial = true, missing fields are fine.
// Returns { fields } (only the fields that were sent) or { error }.
function readArticleBody(body, partial) {
    const fields = {}
    const { title, summary, content, cover_image, published } = body || {}

    if (title !== undefined) {
        if (typeof title !== 'string' || !title.trim() || title.length > 255) {
            return { error: 'title must be a non-empty string of at most 255 characters' }
        }
        fields.title = title.trim()
    } else if (!partial) return { error: 'title is required' }

    if (content !== undefined) {
        if (typeof content !== 'string' || !content.trim()) return { error: 'content must be a non-empty string' }
        fields.content = content
    } else if (!partial) return { error: 'content is required' }

    if (summary !== undefined) {
        if (typeof summary !== 'string') return { error: 'summary must be a string' }
        fields.summary = summary
    }

    const cover = parseCoverImage(cover_image)
    if (cover.error) return { error: cover.error }
    if (cover.provided) fields.cover_image = cover.value

    if (published !== undefined) {
        if (typeof published !== 'boolean') return { error: 'published must be true or false' }
        fields.published = published
    }
    return { fields }
}

function articleRoutes({ requireAdmin, getApiRateLimit }) {
    const router = express.Router()

    // Public: published articles, newest first, without content.
    router.get('/articles/next/:offset', getApiRateLimit, async (req, res) => {
        const offset = Number(req.params.offset)
        if (!Number.isInteger(offset) || offset < 0) return res.status(400).send({ err: 'Invalid offset' })
        try {
            const data = await pool.query(`SELECT ${LIST_FIELDS} FROM articles
                WHERE published
                ORDER BY date_published DESC, ID DESC
                LIMIT $1 OFFSET $2`, [PAGE_SIZE, offset])
            res.status(200).send({ children: data.rows, nextOffset: offset + PAGE_SIZE })
        } catch (err) {
            console.log(err)
            res.sendStatus(500)
        }
    })

    // Public: one published article with its full content.
    router.get('/article/:id', getApiRateLimit, async (req, res) => {
        const id = parseId(req.params.id)
        if (!id) return res.status(400).send({ err: 'Invalid id' })
        try {
            const data = await pool.query('SELECT * FROM articles WHERE ID = $1 AND published', [id])
            if (data.rowCount === 0) return res.sendStatus(404)
            res.status(200).send({ children: data.rows })
        } catch (err) {
            console.log(err)
            res.sendStatus(500)
        }
    })

    // Admin: every article, drafts included, with content (for the dashboard).
    router.get('/articles/all', requireAdmin, async (req, res) => {
        try {
            const data = await pool.query('SELECT * FROM articles ORDER BY date_updated DESC')
            res.status(200).send({ children: data.rows })
        } catch (err) {
            console.log(err)
            res.sendStatus(500)
        }
    })

    router.post('/article', requireAdmin, async (req, res) => {
        const { fields, error } = readArticleBody(req.body, false)
        if (error) return res.status(400).send({ err: error })
        try {
            const data = await pool.query(`INSERT INTO articles
                (title, summary, content, cover_image, published, date_published)
                VALUES ($1, $2, $3, $4, $5, CASE WHEN $5 THEN CURRENT_TIMESTAMP ELSE NULL END)
                RETURNING ID`,
                [fields.title, fields.summary ?? '', fields.content, fields.cover_image ?? null, fields.published ?? false])
            console.log(`Post - Article ${fields.title}`)
            res.status(201).send({ message: 'Added article to database', id: data.rows[0].id })
        } catch (err) {
            console.log(err)
            res.status(500).send({ err: 'An error occured while attempting to update the database' })
        }
    })

    // Update only the fields that are sent.
    router.patch('/article/:id', requireAdmin, async (req, res) => {
        const id = parseId(req.params.id)
        if (!id) return res.status(400).send({ err: 'Invalid id' })
        const { fields, error } = readArticleBody(req.body, true)
        if (error) return res.status(400).send({ err: error })
        const names = Object.keys(fields)
        if (names.length === 0) return res.status(400).send({ err: 'Nothing to update' })

        // Column names come from our own whitelist above, never from the request.
        const sets = names.map((name, i) => `${name} = $${i + 1}`)
        sets.push('date_updated = CURRENT_TIMESTAMP')
        // First time it is published, record when.
        if (fields.published === true) sets.push('date_published = COALESCE(date_published, CURRENT_TIMESTAMP)')
        try {
            const data = await pool.query(
                `UPDATE articles SET ${sets.join(', ')} WHERE ID = $${names.length + 1}`,
                [...names.map(n => fields[n]), id])
            if (data.rowCount === 0) return res.sendStatus(404)
            res.status(200).send({ message: 'Successfully updated article' })
        } catch (err) {
            console.log(err)
            res.sendStatus(500)
        }
    })

    router.delete('/article/:id', requireAdmin, async (req, res) => {
        const id = parseId(req.params.id)
        if (!id) return res.status(400).send({ err: 'Invalid id' })
        try {
            const data = await pool.query('DELETE FROM articles WHERE ID = $1', [id])
            if (data.rowCount === 0) return res.sendStatus(404)
            console.log(`Deleting article ID: ${id}`)
            res.sendStatus(204)
        } catch (err) {
            console.log(err)
            res.sendStatus(500)
        }
    })

    return router
}

module.exports = { articleRoutes }
