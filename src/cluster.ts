import cluster, { Worker } from 'cluster';
import os from 'os';
import net from 'net';

const getWorkerIndex = (ip: string, length: number): number => {
  let hash = 0;
  for (let i = 0; i < ip.length; i++) {
    const char = ip.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash) % length;
};

export const initCluster = (apiPort: number) => {
  const numCPUs = os.cpus().length;
  const workers: Worker[] = [];

  for (let i = 0; i < numCPUs; i++) {
    workers[i] = cluster.fork();
  }

  cluster.on('exit', (worker) => {
    console.log(`Worker ${worker.process.pid} exited. Spawning a new process.`);
    const index = workers.indexOf(worker);
    workers[index] = cluster.fork();
  });

  const server = net.createServer({ pauseOnConnect: true }, (socket) => {
    const ip = socket.remoteAddress || '';
    const worker = workers[getWorkerIndex(ip, workers.length)];
    worker.send('sticky-session:connection', socket);
  });

  server.listen(apiPort, () => {
    console.log(`Master listening on API port ${apiPort}`);
  });
};

export default initCluster;
