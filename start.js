#!/usr/bin/env node

// Simple production starter for Replit
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Starting BIMA AI Decision App on Replit...');

// Check if dist folder exists
const distPath = path.join(__dirname, 'dist');
if (!fs.existsSync(distPath)) {
  console.log('📦 Building production version...');
  const build = spawn('npm', ['run', 'build'], { stdio: 'inherit' });
  
  build.on('close', (code) => {
    if (code === 0) {
      console.log('✅ Build completed successfully!');
      startServer();
    } else {
      console.log('❌ Build failed. Starting server anyway...');
      startServer();
    }
  });
} else {
  console.log('📁 Using existing build...');
  startServer();
}

function startServer() {
  console.log('🌐 Starting server...');
  const server = spawn('node', ['server/index.js'], { stdio: 'inherit' });
  
  server.on('close', (code) => {
    console.log(`Server exited with code ${code}`);
  });
}