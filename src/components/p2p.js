import axios from 'axios'

const WebSocketTracker = require('bittorrent-tracker/lib/client/websocket-tracker')
const randombytes = require('randombytes')
const WebTorrent = require('webtorrent')
const EventEmitter = require('events')
const chunks = require('chunk-stream')
const str = require('string-to-stream')

var announce = [
  'ws://localhost:5000',
  'wss://tracker.openwebtorrent.com',
  'wss://tracker.sloppyta.co:443/announce',
  'wss://tracker.novage.com.ua:443/announce',
]

if (window.location.hostname === 'localhost')
  announce = ['ws://localhost:5000']

const infoHash = '62f753362edbfcc2f59593a050bf271d20dec9d2'
var msgBindCallback = (type, msg) => {};

if (localStorage.getItem('beAProxy') === "true") {
  // Proxy

  // Seed the torrent
  var client = new WebTorrent()

  var f = new File(['p2wiki'], 'p2wiki')

  client.seed(f, {
    announce: announce
  }, (torrent) => {
    // Will be 62f753362edbfcc2f59593a050bf271d20dec9d2
    console.log(torrent.infoHash)

    torrent.on('peer', (peer) => {
      peer.on('data', data => {
        // got a data channel message
        console.log('got a message from a client: ' + data)

        if (data.toString() === 'c')
          peer.send('p') // Pong

        try {
          var j = JSON.parse(data)
          axios.get(`//en.wikipedia.org/w/api.php?action=parse&format=json&page=${j.q}&prop=text&formatversion=2&origin=*`).then(res => {
            console.log(res)
            var response = JSON.stringify(res)
            const chunkLength = 16000;

            while (response.length > 0) {
              peer.send(response.slice(0, chunkLength))
              response = response.slice(chunkLength)
            }

            console.log(response)
          }).catch((err) => {
            console.log(err)
          })
        } catch (e) {}
      })
    })
  })
} else {
  var peers = {}
  var bestPeers = [] // The last elem will have the last msged peer id
  
  function removePeer(id) {
    delete peers[id]
    delete bestPeers[bestPeers.indexOf(id)]
    msgBindCallback('peersCount', Object.keys(peers).length)
  }

  class Client extends EventEmitter {
    constructor() {
      super()

      this.infoHash = infoHash.toLowerCase()
      this._infoHashBuffer = Buffer.from(this.infoHash, 'hex')
      this._infoHashBinary = this._infoHashBuffer.toString('binary')

      this._peerIdBuffer = randombytes(20)
      this._peerId = this._peerIdBuffer.toString('hex')
      this._peerIdBinary = this._peerIdBuffer.toString('binary')
    }

    _defaultAnnounceOpts (opts = {}) {
      if (opts.numwant == null) opts.numwant = 50
  
      if (opts.uploaded == null) opts.uploaded = 0
      if (opts.downloaded == null) opts.downloaded = 0

      return opts
    }
  }

  client = new Client()

  var tracker = new WebSocketTracker(client, announce[0])
  tracker.announce({
    numwant: 50,
  })

  client.on('peer', (peer) => {
    peer.on('data', (d) => {
      // Acknowledge pong
      if (d.toString() === 'p') {
        if (peers[peer.id] === undefined) {
          peers[peer.id] = peer
          bestPeers.push(peer.id)

          msgBindCallback('peersCount', Object.keys(peers).length)
        }

        // Move this "active" peer to last of array
        // https://stackoverflow.com/a/24909567
        bestPeers.push(bestPeers.splice(bestPeers.indexOf(peer.id), 1)[0])
      }
    })
    peer.on('connect', () => {
      /**
       * Keep pinging
       */
      var t = () => {
        if (!peer.connected) {
          removePeer(peer.id)
        } else {
          peer.send('c') // A ping msg
        }
      }
      setTimeout(t, 1000)
    })
    peer.on('error', (err) => {
      console.log(err)
      removePeer(peer.id)
      console.log('ccc')
    })
    peer.on('close', () => {
      removePeer(peer.id)
      console.log('cccaaa')
    })
  })
}

// Get the best peer
function getAPeer() {
  var keys = Object.keys(peers)

  if (keys.length === 0)
    return false

  return peers[bestPeers[bestPeers.length - 1]]
}

function messagePeer (msg) {
  return new Promise(function (resolve, reject) {
    var peer = getAPeer()

    if (!peer) {
      msgBindCallback('search', 'No peers available')
      reject('nopeer')
    } else {
      var previousData = '';
      peer.on('data', data => {
        previousData += data.toString()
        if (data.length !== 16000) {
          try {
            var json = JSON.parse(previousData)
            previousData = '';
            resolve(json)
          } catch (e) {}
        }
      })
      
      peer.send(msg)

      peer.on('error', err => {
        msgBindCallback('search', 'Peer connection failed')
        reject(Error(err))
      })
    }
  })
}

export function requestArticle (q) {
  return messagePeer(
    JSON.stringify({ q: q })
  )
}

export function msgBind (callback) {
  msgBindCallback = callback
}