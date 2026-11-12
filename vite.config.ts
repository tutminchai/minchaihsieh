import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {config} from './admin-src/config';
import {isPublicKey} from './admin-src/public-config';
if(config.publishableKey&&!isPublicKey(config.publishableKey))throw new Error('Build refused: browser configuration requires a publishable or legacy anon key.');
export default defineConfig({root:'admin-src',base:'/minchaihsieh/admin/',plugins:[react()],build:{outDir:'../admin',emptyOutDir:true}});
