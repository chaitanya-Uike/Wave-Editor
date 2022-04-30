const http = require('http');
const express = require('express');
const shareDB = require('sharedb');
const richText = require('rich-text');
const WebSocket = require('ws')
const WebSocketJSONStream = require('@teamwork/websocket-json-stream');
const { v4: uuidv4 } = require('uuid');

shareDB.types.register(richText.type)

const backend = new shareDB({ presence: true, doNotForwardSendPresenceErrorsToClient: true })

const app = express()
app.set('view engine', 'ejs')
app.use(express.static('static'))
app.use(express.static('node_modules/quill/dist'))
app.use(express.json())

const server = http.createServer(app)

const connection = backend.connect()

app.get('/', function (req, res) {
    const roomId = uuidv4()
    return res.redirect(`/${roomId}`)
})

app.get('/:roomId', (req, res) => {
    const roomId = req.params.roomId

    // create a new document
    const doc = connection.get('text-editor', roomId)
    // fetch the document state 
    doc.fetch(function (err) {
        if (err)
            return res.status(500).json({ "msg": err })

        // if document does not exist, create it
        if (doc.type === null) {
            doc.create([{ insert: '' }], 'rich-text')
        }
    })

    return res.render('room', { roomId })
})


const wss = new WebSocket.Server({ server: server })

wss.on('connection', (ws) => {
    const stream = new WebSocketJSONStream(ws)
    backend.listen(stream)
})

const PORT = process.env.PORT || 8080

server.listen(PORT, console.log(`Server is Listening on port ${PORT}`))
