const fs = require('fs');
const data = JSON.parse(fs.readFileSync('C:/Users/analista2.desarrollo/.gemini/antigravity/brain/70c93249-2e8b-415a-951c-71200cd66113/.system_generated/steps/81/output.txt', 'utf8'));
const content = data.files[0].content;
fs.writeFileSync('c:/Users/analista2.desarrollo/Desktop/bot-logistica/supabase/functions/bot_logistica/index.ts', content);
console.log('Restored index.ts');
