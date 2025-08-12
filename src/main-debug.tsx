import { createRoot } from 'react-dom/client'
import './index.css'

console.log('main-debug.tsx loaded');

const rootElement = document.getElementById('root');
console.log('Root element:', rootElement);

if (!rootElement) {
  document.body.innerHTML = '<h1 style="color: red;">Error: Root element not found!</h1>';
} else {
  try {
    console.log('About to import App...');
    import('./App').then(({ default: App }) => {
      console.log('App imported successfully');
      const root = createRoot(rootElement);
      root.render(<App />);
      console.log('App rendered');
    }).catch(error => {
      console.error('Failed to import App:', error);
      rootElement.innerHTML = `<h1 style="color: red;">Failed to load App: ${error.message}</h1>`;
    });
  } catch (error) {
    console.error('Error in main-debug:', error);
    rootElement.innerHTML = `<h1 style="color: red;">Error: ${error}</h1>`;
  }
}