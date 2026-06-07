/**
 * DEEPSEEK — AI API caller
 * Provider-agnostic: bisa diganti OpenAI/Gemini dll tinggal ganti module ini
 */
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';

async function callAI(systemPrompt, userPrompt, maxTokens) {
  if (!DEEPSEEK_KEY) throw new Error('DEEPSEEK_API_KEY not set');
  
  var r = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + DEEPSEEK_KEY
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: maxTokens || 150,
      temperature: 0.8
    })
  });
  
  if (!r.ok) {
    var err = await r.text();
    throw new Error('DeepSeek ' + r.status + ': ' + err.substring(0, 80));
  }
  
  var json = await r.json();
  var text = (json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content) || '';
  return text.replace(/^["']|["']$/g, '').trim();
}

module.exports = { callAI };
