const ReconnectingWebSocket = require('reconnecting-websocket');
const sharedb = require('sharedb/lib/client');
const richText = require('rich-text');
const Quill = require('quill');

sharedb.types.register(richText.type);

// Open WebSocket connection to ShareDB server
const socket = new ReconnectingWebSocket('ws://' + window.location.host);
const connection = new sharedb.Connection(socket);

// get the document and connect to it
const doc = connection.get('text-editor', ROOM_ID)

// subscribe to the document for changes
doc.subscribe(function (err) {
    if (err) throw err;

    const quill = new Quill('#editor', { theme: 'snow' });
    quill.setContents(doc.data);

    // listen for changes on the editor
    quill.on('text-change', function (delta, oldDelta, source) {
        if (source !== 'user') return;

        doc.submitOp(delta, { source: quill });
    });

    doc.on('op', function (op, source) {
        // if it is applied by self return
        if (source === quill) return
        quill.updateContents(op)
    })
})