import crypto from 'crypto';
import fetch from 'node-fetch';

async function generateSRI(url) {
  try {
    const response = await fetch(url);
    const content = await response.text();
    
    // Generate SHA-384 hash
    const hash = crypto.createHash('sha384').update(content).digest('base64');
    
    console.log(`URL: ${url}`);
    console.log(`Integrity hash: sha384-${hash}`);
    console.log(`\nAdd this to your script tag:\nintegrity="sha384-${hash}"`);
    
    return hash;
  } catch (error) {
    console.error('Error generating SRI:', error);
    process.exit(1);
  }
}

// Generate SRI for the external script
generateSRI('https://cdn.gpteng.co/gptengineer.js'); 