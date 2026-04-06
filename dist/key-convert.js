"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const key = fs_1.default.readFileSync('./key.json', 'utf8');
const base64 = Buffer.from(key).toString('base64');
console.log(base64);
