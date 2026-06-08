import { EventEmitter } from 'events';

// Decoupled event bus — avoids circular imports between index.js and services
export const appEvents = new EventEmitter();
