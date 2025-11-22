import { Peer, DataConnection } from 'peerjs';
import { InputPacket, StatePacket, GameStartPacket } from '../types';

type MessageHandler = (data: any) => void;

class MultiplayerService {
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private myId: string = '';
  private onDataCallback: MessageHandler | null = null;
  private isHost: boolean = false;

  async initialize(host: boolean): Promise<string> {
    this.isHost = host;
    return new Promise((resolve, reject) => {
      // Create peer. If host, we let peerjs generate ID (or could specify). 
      // If client, we generate ID.
      this.peer = new Peer();

      this.peer.on('open', (id) => {
        this.myId = id;
        console.log('My Peer ID is: ' + id);
        resolve(id);
      });

      this.peer.on('connection', (conn) => {
        this.handleConnection(conn);
      });

      this.peer.on('error', (err) => {
        console.error('PeerJS error', err);
        reject(err);
      });
    });
  }

  connectToHost(hostId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.peer) return reject("Peer not initialized");
      
      const conn = this.peer.connect(hostId);
      
      conn.on('open', () => {
        this.handleConnection(conn);
        resolve();
      });

      conn.on('error', (err) => {
        reject(err);
      });
    });
  }

  private handleConnection(conn: DataConnection) {
    this.connections.set(conn.peer, conn);

    conn.on('data', (data) => {
      if (this.onDataCallback) {
        this.onDataCallback(data);
      }
    });

    conn.on('close', () => {
      this.connections.delete(conn.peer);
      console.log("Connection closed: ", conn.peer);
    });
  }

  sendToAll(data: StatePacket | GameStartPacket) {
    this.connections.forEach(conn => {
      if (conn.open) conn.send(data);
    });
  }

  sendToHost(data: InputPacket) {
    // Clients only have one connection usually, but we iterate to be safe
    this.connections.forEach(conn => {
      if (conn.open) conn.send(data);
    });
  }

  setOnData(cb: MessageHandler) {
    this.onDataCallback = cb;
  }

  getMyId() {
    return this.myId;
  }

  getConnectionsCount() {
    return this.connections.size;
  }
  
  destroy() {
      this.connections.forEach(c => c.close());
      this.peer?.destroy();
      this.peer = null;
  }
}

export const multiplayer = new MultiplayerService();