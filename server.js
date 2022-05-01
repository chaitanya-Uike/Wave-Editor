const env = process.env.NODE_ENV || 'development'

if (env === 'development') {
    require('dotenv').config()
}

const http = require('http')
const express = require('express')
const shareDB = require('sharedb')
const richText = require('rich-text')
// for shareDB we need ws
const WebSocket = require('ws')
const WebSocketJSONStream = require('@teamwork/websocket-json-stream')
const { v4: uuidv4 } = require('uuid')

// installing mongoDB adapter for shareDB
const db = require('sharedb-mongo')(process.env.MONGO_URI);

shareDB.types.register(richText.type)

const backend = new shareDB({ db: db, presence: true, doNotForwardSendPresenceErrorsToClient: true })

const app = express()
app.set('view engine', 'ejs')
app.use(express.static('public'))
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
            doc.create([{ insert: 'Compose an Epic...', attributes: { italic: true, font: "playfair" } }], 'rich-text')
        }
    })

    return res.render('room', { roomId })
})

const io = require('socket.io')(server)
const wss = new WebSocket.Server({ server: server })


/*
    **VIMP
    to run socket.io and ws on single HTTP server we need to handle the upgrade event of our httpServer manually by removing the one added by socket.io
*/
// remove the 'upgrade' events from our httpServer
server.removeAllListeners('upgrade')
server.on('upgrade', function (req, socket, head) {
    // if request is from socket.io
    if (req.url.indexOf('socket.io') > -1) {
        io.engine.handleUpgrade(req, socket, head)
    } else {
        // if request is from wss
        wss.handleUpgrade(req, socket, head, (webSocket) => {
            wss.emit('connection', webSocket, req);
        });
    }
})

wss.on('connection', (ws) => {
    const stream = new WebSocketJSONStream(ws)
    backend.listen(stream)
})

io.on('connection', socket => {
    socket.on('join-room', (roomId, userId) => {
        socket.join(roomId)

        socket.broadcast.to(roomId).emit('user-joined', userId)

        socket.on('disconnect', () => {
            socket.broadcast.to(roomId).emit('user-disconnected', userId)
        })
    })
})

const PORT = process.env.PORT || 8080

server.listen(PORT, console.log(`Server is Listening on port ${PORT}`))
