import http from 'http';
import app from './app';

const createHttpServer = (): http.Server => {
  return http.createServer(app);
};

export default createHttpServer;
