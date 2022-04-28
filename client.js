var ReconnectingWebSocket = require('reconnecting-websocket');
var sharedb = require('sharedb/lib/client');
var richText = require('rich-text');
var Quill = require('quill');
var QuillCursors = require('quill-cursors');
var tinycolor = require('tinycolor2');
var ObjectID = require('bson-objectid');

sharedb.types.register(richText.type);
Quill.register('modules/cursors', QuillCursors);

var connectionButton = document.getElementById('client-connection');
connectionButton.addEventListener('click', function () {
    toggleConnection(connectionButton);
});

var nameInput = document.getElementById('name');

var colors = {};

var collection = 'text-editor';
var id = ROOM_ID;
var presenceId = new ObjectID().toString();

var socket = new ReconnectingWebSocket('ws://' + window.location.host);
var connection = new sharedb.Connection(socket);

var doc = connection.get(collection, id);

doc.subscribe(function (err) {
    if (err) throw err;
    initialiseQuill(doc);
});

function initialiseQuill(doc) {
    var quill = new Quill('#editor', {
        theme: 'bubble',
        modules: { cursors: true }
    });

    var cursors = quill.getModule('cursors');

    quill.setContents(doc.data);

    quill.on('text-change', function (delta, oldDelta, source) {
        if (source !== 'user') return;
        doc.submitOp(delta);
    });

    doc.on('op', function (op, source) {
        if (source) return;
        quill.updateContents(op);
    });

    var presence = doc.connection.getDocPresence(collection, id);

    presence.subscribe(function (error) {
        if (error) throw error;
    });

    var localPresence = presence.create(presenceId);

    quill.on('selection-change', function (range, oldRange, source) {

        if (source !== 'user') return;

        if (!range) return;

        range.name = nameInput.value;
        localPresence.submit(range, function (error) {
            if (error) throw error;
        });
    });

    presence.on('receive', function (id, range) {
        colors[id] = colors[id] || tinycolor.random().toHexString();
        var name = (range && range.name) || 'Anonymous';
        cursors.createCursor(id, name, colors[id]);
        cursors.moveCursor(id, range);
    });

    return quill;
}

function toggleConnection(button) {
    if (button.classList.contains('connected')) {
        button.classList.remove('connected');
        button.textContent = 'Connect';
        disconnect();
    } else {
        button.classList.add('connected');
        button.textContent = 'Disconnect';
        connect();
    }
}

function disconnect() {
    doc.connection.close();
}

function connect() {
    var socket = new ReconnectingWebSocket('ws://' + window.location.host);
    doc.connection.bindToSocket(socket);
}
