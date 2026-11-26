/* Image uploads.
 Files are stored on disk in UPLOAD_DIR (a Docker volume in production) under a
 random name; the database only stores that file name. Files are served
 publicly at /uploads/<name>, so the frontend uses /api/uploads/<name>.
*/
const express = require('express')
const multer = require('multer')
const crypto = require('crypto')
const path = require('path')
const fs = require('fs-extra')
const { pool } = require('../db')

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads')
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

// Only raster formats. SVG is left out on purpose: it can carry scripts.
// The type is decided from the file's first bytes, not from what the browser claims.
function detectImageType(buf) {
    if (buf.length >= 3 && buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'jpg'
    if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) return 'png'
    if (buf.length >= 6 && ['GIF87a', 'GIF89a'].includes(buf.subarray(0, 6).toString('ascii'))) return 'gif'
    if (buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp'
    return null
}

// Names we generate look like <uuid>.<ext>. Anything else is rejected, which
// also rules out path tricks like "../".
const IMAGE_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|gif|webp)$/

// For cover_image fields: undefined = "not provided", null/"" = "no image",
// otherwise it must be one of our file names.
function parseCoverImage(value) {
    if (value === undefined) return { provided: false }
    if (value === null || value === '') return { provided: true, value: null }
    if (typeof value === 'string' && IMAGE_NAME.test(value)) return { provided: true, value }
    return { error: 'cover_image must be an uploaded image file name or null' }
}

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_BYTES, files: 1 }
}).single('image')

function imageRoutes({ authenticateToken }) {
    const router = express.Router()
    fs.ensureDirSync(UPLOAD_DIR)

    // Public: serve uploaded files. Names are unique, so they can be cached forever.
    router.use('/uploads', express.static(UPLOAD_DIR, {
        immutable: true,
        maxAge: '365d',
        dotfiles: 'deny',
        index: false,
        setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff')
    }))

    // Upload one image (multipart form field "image"). Returns { filename }.
    router.post('/image', authenticateToken, (req, res) => {
        upload(req, res, async (err) => {
            if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).send({ err: `Image is larger than ${MAX_BYTES / 1024 / 1024} MB` })
            }
            if (err) {
                console.log(err)
                return res.status(400).send({ err: 'Upload failed' })
            }
            if (!req.file) return res.status(400).send({ err: 'No file sent in the "image" field' })

            const ext = detectImageType(req.file.buffer)
            if (!ext) return res.status(415).send({ err: 'Only JPEG, PNG, GIF and WebP images are allowed' })

            const filename = `${crypto.randomUUID()}.${ext}`
            try {
                await fs.writeFile(path.join(UPLOAD_DIR, filename), req.file.buffer, { flag: 'wx' })
                console.log(`Uploaded image ${filename}`)
                res.status(201).send({ filename })
            } catch (writeErr) {
                console.log(writeErr)
                res.status(500).send({ err: 'Could not save the image' })
            }
        })
    })

    // List uploaded images, newest first (for picking one in the dashboard).
    router.get('/images', authenticateToken, async (req, res) => {
        try {
            const names = (await fs.readdir(UPLOAD_DIR)).filter(n => IMAGE_NAME.test(n))
            const children = await Promise.all(names.map(async (filename) => {
                const stat = await fs.stat(path.join(UPLOAD_DIR, filename))
                return { filename, size: stat.size, uploaded: stat.mtime }
            }))
            children.sort((a, b) => b.uploaded - a.uploaded)
            res.status(200).send({ children })
        } catch (err) {
            console.log(err)
            res.sendStatus(500)
        }
    })

    // Delete an image, unless something still uses it.
    router.delete('/image/:filename', authenticateToken, async (req, res) => {
        const { filename } = req.params
        if (!IMAGE_NAME.test(filename)) return res.status(400).send({ err: 'Invalid image name' })
        try {
            const inUse = await pool.query(`
                SELECT 1 FROM projects WHERE cover_image = $1
                UNION ALL SELECT 1 FROM journals WHERE cover_image = $1
                UNION ALL SELECT 1 FROM articles WHERE cover_image = $1 OR strpos(content, $1) > 0
                LIMIT 1`, [filename])
            if (inUse.rowCount > 0) {
                return res.status(409).send({ err: 'Image is still used by a project, journal or article' })
            }
            await fs.remove(path.join(UPLOAD_DIR, filename))
            res.sendStatus(204)
        } catch (err) {
            console.log(err)
            res.sendStatus(500)
        }
    })

    return router
}

module.exports = { imageRoutes, parseCoverImage, UPLOAD_DIR }
