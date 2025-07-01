// backend/socketRegistry.js
let io = null;

function setSocketIo(serverIo) {
  io = serverIo;
}

function getSocketIo() {
  if (!io) {
    throw new Error("❌ Socket.IO belum diinisialisasi");
  }
  return io;
}

module.exports = { setSocketIo, getSocketIo };
